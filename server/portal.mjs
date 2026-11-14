import express from 'express';
import { createHash, timingSafeEqual } from 'node:crypto';
import { OPERATOR, operatorConfiguration } from './operator.mjs';
import { CLOSED_STATUSES } from '../src/advice-schema.mjs';
const hash=value=>createHash('sha256').update(String(value)).digest();
const same=(a,b)=>timingSafeEqual(hash(a),hash(b));
const UUID=/^[0-9a-f-]{36}$/;
/** Pull/ack contract for NIVO Portal. No direct Odoo access and no arbitrary outbound URL. */
export function createPortalRouter({env,store,auth,now=()=>Date.now()}) {
  const router=express.Router();
  const enabled=Boolean(store&&operatorConfiguration(env).confirmed&&env.PORTAL_EXPORT_ENABLED==='true'&&typeof env.PORTAL_EXPORT_TOKEN==='string'&&env.PORTAL_EXPORT_TOKEN.length>=32);
  router.use((req,res,next)=>{
    if(!enabled)return res.status(503).json({error:'Portal-uitwisseling is niet geactiveerd.'});
    if(!same(req.headers.authorization||'',`Bearer ${env.PORTAL_EXPORT_TOKEN}`))return res.status(401).json({error:'Niet geautoriseerd.'});
    if(!auth.limiter.take(`portal:${auth.requestKey(req)}`,60,60000))return res.status(429).json({error:'Probeer later opnieuw.'});
    if(!req.is('application/json'))return res.status(415).json({error:'Gebruik JSON.'});next();
  });
  router.post('/claim',async(req,res)=>{
    const limit=req.body?.limit??5;
    if(!Number.isInteger(limit)||limit<1||limit>10||Object.keys(req.body||{}).some(k=>k!=='limit'))return res.status(422).json({error:'Ongeldige batch.'});
    const events=[];
    for(const event of await store.claimPortalEvents(limit)) {
      const record=await store.getLead(event.lead_id);const lead=record?.lead;
      if(!lead||lead.controller.name!==OPERATOR.name)continue;
      const active=lead.contactRequested&&!CLOSED_STATUSES.includes(lead.status)&&Date.parse(lead.contactExpiresAt)>now();
      events.push({id:event.id,claimToken:event.claim_token,schema:'zonlio.portal.advice.v1',source:'zonlio',
        type:lead.status==='withdrawn'?'advice.withdrawn':CLOSED_STATUSES.includes(lead.status)?'advice.closed':active?'advice.snapshot':'advice.contact_expired',status:lead.status,
        requestId:lead.id,reference:lead.reference,revision:lead.revision,createdAt:lead.createdAt,updatedAt:lead.updatedAt,
        controller:lead.controller,assignmentHint:lead.followUp.owner||'Pim',
        contact:{requested:active,expiresAt:lead.contactExpiresAt,version:lead.consentVersion,text:lead.contactText},
        ...(active?{person:{name:lead.name,phone:lead.phone,email:lead.email},housing:lead.housing?{...lead.housing,postcode:lead.postcode}:null,
          topic:lead.topic,message:lead.message,sourcePath:lead.sourcePath,scenario:lead.shareScenario?lead.scenario:null,contactPreference:lead.contactPreference}:{}),
      });
    }
    res.json({events,note:'Bevestig pas na duurzame opslag in NIVO Portal. Odoo-synchronisatie hoort bij de Portal, niet bij Zonlio.'});
  });
  router.post('/ack',async(req,res)=>{
    const b=req.body||{};
    if(Object.keys(b).some(k=>!['id','claimToken','portalReference'].includes(k))||!UUID.test(b.id||'')||!UUID.test(b.claimToken||'')||! /^[A-Za-z0-9._:-]{1,120}$/.test(b.portalReference||''))return res.status(422).json({error:'Ongeldige ontvangstbevestiging.'});
    const accepted=await store.ackPortalEvent(b);res.status(accepted?200:409).json({ok:accepted,...(!accepted?{error:'Reservering verlopen of onbekend. Vraag de batch opnieuw op.'}:{})});
  });
  return {router,enabled};
}
