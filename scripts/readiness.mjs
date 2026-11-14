const env=process.env;
const present=name=>typeof env[name]==='string'&&env[name].trim().length>0;
const checks=[
  ['Node.js 24',process.versions.node.split('.')[0]==='24'],
  ['Productiemodus',env.NODE_ENV==='production'],
  ['Eigen HTTPS-domein',env.APP_URL==='https://zonlio.nl'],
  ['MySQL geconfigureerd',['DB_HOST','DB_NAME','DB_USER','DB_PASSWORD'].every(present)],
  ['Beheerder ingesteld',present('ADMIN_EMAIL')&&present('ADMIN_PASSWORD_HASH')],
  ['Sessiegeheim ingesteld',(env.SESSION_SECRET||'').length>=32],
  ['Onderhoudssleutel ingesteld',(env.CRON_SECRET||'').length>=32],
  ['Mail geconfigureerd',present('SMTP_USER')&&(present('SMTP_PASSWORD')||present('SMTP_PASS'))],
  ['Adviesontvanger bevestigd',env.LEAD_CONTROLLER_CONFIRMED==='true'],
];
for(const [name,ok]of checks)console.log(`${ok?'OK':'ONTBREEKT'}  ${name}`);
console.log('Dit controleert alleen configuratie. Verifieer daarnaast database-opslag, SMTP-authenticatie, inboxontvangst, HTTPS en geplande onderhoudstaken. Geheime waarden worden niet afgedrukt.');
process.exitCode=checks.every(([,ok])=>ok)?0:1;
