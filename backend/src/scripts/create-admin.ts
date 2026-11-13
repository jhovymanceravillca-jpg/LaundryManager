import readline from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import bcrypt from 'bcryptjs';
import { pool } from '../config/database';

function hiddenQuestion(prompt: string): Promise<string> {
  if (!stdin.isTTY || !stdin.setRawMode) {
    throw new Error('Ejecuta este comando en una terminal interactiva para ingresar la contraseña de forma oculta.');
  }
  stdout.write(prompt);
  stdin.setRawMode(true);
  stdin.resume();
  return new Promise((resolve, reject) => {
    let value = '';
    const cleanup = () => {
      stdin.off('data', onData);
      stdin.setRawMode(false);
      stdin.pause();
    };
    const onData = (chunk: Buffer) => {
      for (const byte of chunk) {
        if (byte === 3) {
          cleanup();
          stdout.write('\n');
          reject(new Error('Operación cancelada.'));
          return;
        }
        if (byte === 10 || byte === 13) {
          cleanup();
          stdout.write('\n');
          resolve(value);
          return;
        }
        if (byte === 8 || byte === 127) {
          value = value.slice(0, -1);
        } else if (byte >= 32) {
          value += String.fromCharCode(byte);
        }
      }
    };
    stdin.on('data', onData);
  });
}

async function main() {
  const rl = readline.createInterface({ input: stdin, output: stdout });
  try {
    const fullName = (await rl.question('Nombre del administrador: ')).trim();
    const email = (await rl.question('Correo del administrador: ')).trim().toLowerCase();
    rl.close();
    const password = await hiddenQuestion('Contraseña (mínimo 12 caracteres; no se mostrará): ');
    if (!fullName || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 12) {
      throw new Error('Nombre/correo inválido o contraseña de menos de 12 caracteres.');
    }
    const hash = await bcrypt.hash(password, 12);
    await pool.execute(
      "INSERT INTO users (full_name, email, password_hash, role) VALUES (?, ?, ?, 'ADMIN')",
      [fullName, email, hash]
    );
    console.log('Administrador creado.');
  } finally {
    rl.close();
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'No se pudo crear el administrador.');
  process.exitCode = 1;
});
