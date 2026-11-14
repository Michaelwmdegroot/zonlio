import { createInterface } from 'node:readline/promises';
import { hashPassword } from '../server/auth.mjs';

function hiddenQuestion(prompt) {
  return new Promise((resolve, reject) => {
    process.stdout.write(prompt);
    let value = '';
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');
    const cleanup = () => { process.stdin.removeListener('data', input); process.stdin.setRawMode(false); process.stdin.pause(); process.stdout.write('\n'); };
    const input = (chunk) => {
      for (const character of chunk) {
        if (character === '\u0003') { cleanup(); reject(new Error('Geannuleerd.')); return; }
        if (character === '\r' || character === '\n') { cleanup(); resolve(value); return; }
        if (character === '\u007f' || character === '\b') value = value.slice(0, -1);
        else if (character >= ' ' && value.length < 1024) value += character;
      }
    };
    process.stdin.on('data', input);
  });
}

try {
  if (!process.stdin.isTTY || !process.stdout.isTTY) throw new Error('Start deze opdracht in een interactieve terminal; geef wachtwoorden niet als argument mee.');
  const readline = createInterface({ input: process.stdin, output: process.stdout });
  const email = (await readline.question('Beheer-e-mailadres [info@zonlio.nl]: ')).trim() || 'info@zonlio.nl';
  readline.close();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Ongeldig e-mailadres.');
  const password = await hiddenQuestion('Nieuw beheerderswachtwoord (minimaal 12 tekens, verborgen): ');
  const confirmation = await hiddenQuestion('Herhaal het wachtwoord (verborgen): ');
  if (password !== confirmation) throw new Error('De wachtwoorden komen niet overeen.');
  const hash = await hashPassword(password);
  process.stdout.write(`\nVoeg deze waarden toe aan de beveiligde hostingconfiguratie:\nADMIN_EMAIL=${email}\nADMIN_PASSWORD_HASH=${hash}\n\nBewaar ook een willekeurige SESSION_SECRET van minimaal 32 tekens.\n`);
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
}
