import test from 'node:test';
import assert from 'node:assert/strict';
import {HOSTINGER_DKIM,observeMailDns,summarizeSpf,summarizeDmarc} from '../scripts/mail-dns.mjs';

const fixture=()=>({
 resolveMx:async()=>[{exchange:'mx2.hostinger.com.',priority:10},{exchange:'mx1.hostinger.com.',priority:5}],
 resolveCname:async name=>[HOSTINGER_DKIM.find(row=>row.hostname===name).expectedTarget],
 resolveTxt:async name=>name==='zonlio.nl'?[['v=spf1 include:_spf.mail.','hostinger.com ~all'],['site-verification=do-not-copy-this']]:name==='_dmarc.zonlio.nl'?[['v=DMARC1; p=none; rua=mailto:private-report@example.invalid; ruf=mailto:another@example.invalid']]:[['v=DKIM1; k=rsa; p=U1lOVEhFVElDLVBVQkxJQy1LRVk=']],
});
test('public DNS observation identifies documented records without claiming inbox authentication or revealing unrelated TXT',async()=>{
 const report=await observeMailDns({resolver:fixture(),now:()=>Date.parse('2026-11-14T12:00:00Z')});
 assert.equal(report.defaultHostingerRecordsObserved,true);assert.equal(report.lookupFailures,0);
 assert.equal(report.dmarc.policy,'none');assert.equal(report.dmarc.aggregateReportsConfigured,true);
 assert.equal(report.authenticationResultsVerified,false);assert.equal(report.receivedDkimSignatureVerified,false);assert.equal(report.unsubscribeHeadersVerified,false);assert.equal(report.inboxDeliveryVerified,false);
 assert.doesNotMatch(JSON.stringify(report),/private-report|another@example|site-verification|U1lOVEh/);
 assert.equal(report.mx.records[0].priority,5);
});
test('duplicate SPF/DMARC records and duplicated policy tags are not marked observed',()=>{
 assert.equal(summarizeSpf([['v=spf1 ~all'],['v=spf1 -all']]).status,'multiple_records');
 assert.equal(summarizeSpf([['v=spf1 +all']]).unrestrictedAll,true);
 assert.equal(summarizeDmarc([['v=DMARC1; p=none'],['v=DMARC1; p=reject']]).status,'multiple_records');
 assert.equal(summarizeDmarc([['v=DMARC1; p=none; p=reject']]).status,'needs_review');
 assert.equal(summarizeDmarc([['v=DMARC1; p=reject; pct=200']]).status,'needs_review');
});
test('refused DNS is reported as inconclusive while negative answers are reported separately',async()=>{
 const resolver=fixture();resolver.resolveMx=async()=>{throw Object.assign(new Error('private resolver details'),{code:'ECONNREFUSED'});};resolver.resolveCname=async()=>{throw Object.assign(new Error('record absent'),{code:'ENODATA'});};
 const report=await observeMailDns({resolver});assert.equal(report.lookupFailures,1);assert.equal(report.mx.status,'lookup_failed');
 assert.equal(report.dkim[0].cname.status,'not_found');assert.equal(report.defaultHostingerRecordsObserved,false);
 assert.doesNotMatch(JSON.stringify(report),/private resolver details|record absent/);
});
test('unexpected DKIM target is never followed and an empty published key is not accepted',async()=>{
 const resolver=fixture();const asked=[];const txt=resolver.resolveTxt;
 resolver.resolveTxt=async name=>{asked.push(name);return name===HOSTINGER_DKIM[1].expectedTarget?[['v=DKIM1; p=']]:txt(name);};
 resolver.resolveCname=async name=>name===HOSTINGER_DKIM[0].hostname?['unrelated.example.invalid']:[HOSTINGER_DKIM.find(row=>row.hostname===name).expectedTarget];
 const report=await observeMailDns({resolver});assert.equal(report.dkim[0].expectedTargetObserved,false);assert.equal(report.dkim[1].key.keyPublished,false);
 assert.equal(asked.includes('unrelated.example.invalid'),false);assert.equal(report.defaultHostingerRecordsObserved,false);
});
