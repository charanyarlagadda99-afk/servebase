import { Client } from 'pg';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { spawn, execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

export async function setup() {
  console.log('Setting up ServeBase Eval Harness...');

  const pgClient = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    database: 'postgres'
  });

  await pgClient.connect();
  
  // Terminate any connections to the db before dropping
  await pgClient.query(`
    SELECT pg_terminate_backend(pid) 
    FROM pg_stat_activity 
    WHERE datname = 'servebase_eval' AND pid <> pg_backend_pid();
  `);
  
  await pgClient.query('DROP DATABASE IF EXISTS servebase_eval');
  await pgClient.query('CREATE DATABASE servebase_eval');
  await pgClient.end();

  const evalClient = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    database: 'servebase_eval'
  });

  await evalClient.connect();

  console.log('Applying database schema (api/src/db/schema.sql)...');
  const schemaSql = readFileSync(join(rootDir, 'api', 'src', 'db', 'schema.sql'), 'utf-8');
  await evalClient.query(schemaSql);
  console.log('Schema applied successfully.');

  console.log('Seeding minimal test fixtures...');
  const managerPinHash = '$2a$10$eq9.g41PSYeg4sDqZuwtqe8oZ509F5EgDndmBVNPvgI454W2aXZwS'; // 1234
  const cashierPinHash = '$2a$10$qdQQuu8aEI0aBpGU9ZFUIuIEJ2EDPQoenaLBTo/DfZRYF5/AQLtQS'; // 5678

  await evalClient.query(`
    INSERT INTO organizations (id, name) VALUES ('11111111-1111-1111-1111-111111111111', 'Test Org');
    INSERT INTO brands (id, organization_id, name) VALUES ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'Test Brand');
    INSERT INTO outlets (id, brand_id, name, code, gstin, address, tax_mode, service_charge_enabled, service_charge_percent) 
    VALUES ('33333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222', 'Test Outlet', 'OUT1', '07AAAAA0000A1Z5', '123 Test St', 'no_itc_5', false, 0.00);
    
    INSERT INTO terminals (id, outlet_id, name, terminal_code) VALUES ('44444444-4444-4444-4444-444444444444', '33333333-3333-3333-3333-333333333333', 'Main POS', 'T1');
    
    INSERT INTO roles (id, name, permissions) VALUES 
      ('55555555-5555-5555-5555-555555555555', 'Manager', '["*"]'),
      ('66666666-6666-6666-6666-666666666666', 'Cashier', '["pos.access"]');

    INSERT INTO users (id, full_name, pin_hash) VALUES 
      ('77777777-7777-7777-7777-777777777777', 'Rajiv Singhania', '${managerPinHash}'),
      ('88888888-8888-8888-8888-888888888888', 'Pooja Verma', '${cashierPinHash}');

    INSERT INTO user_outlet_roles (user_id, outlet_id, role_id) VALUES 
      ('77777777-7777-7777-7777-777777777777', '33333333-3333-3333-3333-333333333333', '55555555-5555-5555-5555-555555555555'),
      ('88888888-8888-8888-8888-888888888888', '33333333-3333-3333-3333-333333333333', '66666666-6666-6666-6666-666666666666');
      
    INSERT INTO floor_areas (id, outlet_id, name) VALUES ('99999999-9999-9999-9999-999999999999', '33333333-3333-3333-3333-333333333333', 'Main Hall');
    INSERT INTO tables (id, outlet_id, area_id, table_number, status) VALUES 
      ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '33333333-3333-3333-3333-333333333333', '99999999-9999-9999-9999-999999999999', 'T1', 'available'),
      ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '33333333-3333-3333-3333-333333333333', '99999999-9999-9999-9999-999999999999', 'T2', 'available'),
      ('cccccccc-cccc-cccc-cccc-cccccccccccc', '33333333-3333-3333-3333-333333333333', '99999999-9999-9999-9999-999999999999', 'T3', 'available'),
      ('dddddddd-dddd-dddd-dddd-dddddddddddd', '33333333-3333-3333-3333-333333333333', '99999999-9999-9999-9999-999999999999', 'T4', 'available'),
      ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '33333333-3333-3333-3333-333333333333', '99999999-9999-9999-9999-999999999999', 'T5', 'available');
      
    INSERT INTO kitchen_stations (id, outlet_id, name, station_code) VALUES 
      ('ffffffff-ffff-ffff-ffff-ffffffffffff', '33333333-3333-3333-3333-333333333333', 'Hot Kitchen', 'HOT'),
      ('00000000-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333', 'Cold Kitchen', 'COLD');
      
    INSERT INTO categories (id, outlet_id, name) VALUES ('00000000-0000-0000-0000-000000000002', '33333333-3333-3333-3333-333333333333', 'Food');
    
    INSERT INTO menu_items (id, outlet_id, category_id, station_id, name, base_price_paise, tax_rate_percent) VALUES 
      ('00000000-0000-0000-0000-000000000003', '33333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000002', 'ffffffff-ffff-ffff-ffff-ffffffffffff', 'Burger', 20000, 5.00),
      ('00000000-0000-0000-0000-000000000004', '33333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000002', 'ffffffff-ffff-ffff-ffff-ffffffffffff', 'Pizza', 40000, 5.00),
      ('00000000-0000-0000-0000-000000000005', '33333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Salad', 15000, 5.00),
      ('00000000-0000-0000-0000-000000000006', '33333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Ice Cream', 10000, 5.00),
      ('00000000-0000-0000-0000-000000000007', '33333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000002', 'ffffffff-ffff-ffff-ffff-ffffffffffff', 'Pasta', 30000, 5.00);

    INSERT INTO uoms (id, name, symbol) VALUES ('00000000-0000-0000-0000-000000000010', 'Kilogram', 'KG');
    
    INSERT INTO raw_materials (id, outlet_id, name, sku, uom_id) VALUES 
      ('00000000-0000-0000-0000-000000000011', '33333333-3333-3333-3333-333333333333', 'Tomato', 'RM01', '00000000-0000-0000-0000-000000000010'),
      ('00000000-0000-0000-0000-000000000012', '33333333-3333-3333-3333-333333333333', 'Potato', 'RM02', '00000000-0000-0000-0000-000000000010'),
      ('00000000-0000-0000-0000-000000000013', '33333333-3333-3333-3333-333333333333', 'Cheese', 'RM03', '00000000-0000-0000-0000-000000000010'),
      ('00000000-0000-0000-0000-000000000014', '33333333-3333-3333-3333-333333333333', 'Lettuce', 'RM04', '00000000-0000-0000-0000-000000000010'),
      ('00000000-0000-0000-0000-000000000015', '33333333-3333-3333-3333-333333333333', 'Beef', 'RM05', '00000000-0000-0000-0000-000000000010');
      
    INSERT INTO recipes (id, menu_item_id) VALUES 
      ('00000000-0000-0000-0000-000000000020', '00000000-0000-0000-0000-000000000003'), 
      ('00000000-0000-0000-0000-000000000021', '00000000-0000-0000-0000-000000000004');
    
    INSERT INTO recipe_ingredients (recipe_id, raw_material_id, quantity, uom_id) VALUES 
      ('00000000-0000-0000-0000-000000000020', '00000000-0000-0000-0000-000000000015', 0.2, '00000000-0000-0000-0000-000000000010'),
      ('00000000-0000-0000-0000-000000000021', '00000000-0000-0000-0000-000000000013', 0.1, '00000000-0000-0000-0000-000000000010');

    INSERT INTO rooms (id, outlet_id, room_number, room_type, status, base_tariff_paise) VALUES 
      ('11110000-0000-0000-0000-000000000101', '33333333-3333-3333-3333-333333333333', '101', 'deluxe', 'clean', 650000);

    INSERT INTO guests (id, name, phone, email) VALUES 
      ('22220000-0000-0000-0000-000000000001', 'Vikramaditya Roy', '+919876543210', 'vikram@example.com');
  `);

  await evalClient.end();
  console.log('Seed fixtures inserted.');

  console.log('Starting API server on port 3001...');
  const apiProcess = spawn('npx', ['tsx', 'api/src/server.ts'], {
    cwd: rootDir,
    env: { ...process.env, PORT: '3001', PGDATABASE: 'servebase_eval' },
    stdio: 'pipe',
    shell: true
  });

  const webProcess = spawn('npx', ['vite', '--port', '5174'], {
    cwd: join(rootDir, 'web'),
    env: { ...process.env, VITE_API_URL: 'http://localhost:3001' },
    stdio: 'pipe',
    shell: true
  });

  apiProcess.stdout?.on('data', (d) => {
    const s = d.toString().trim();
    if (s) console.log('[API]', s);
  });
  apiProcess.stderr?.on('data', (d) => {
    const s = d.toString().trim();
    if (s) console.log('[API ERROR]', s);
  });

  // Poll until API responds to /health
  console.log('Waiting for API server /health to be ready...');
  let apiReady = false;
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch('http://localhost:3001/health');
      if (res.ok) {
        apiReady = true;
        console.log('API server is ready!');
        break;
      }
    } catch {}
    await new Promise(r => setTimeout(r, 500));
  }

  if (!apiReady) {
    console.warn('API server did not respond to /health in time, continuing anyway...');
  }

  return {
    apiUrl: 'http://localhost:3001',
    webUrl: 'http://localhost:5174',
    stop: () => {
      try {
        if (process.platform === 'win32') {
          if (apiProcess.pid) execSync(`taskkill /F /T /PID ${apiProcess.pid} 2>nul`);
          if (webProcess.pid) execSync(`taskkill /F /T /PID ${webProcess.pid} 2>nul`);
        } else {
          apiProcess.kill();
          webProcess.kill();
        }
      } catch {}
    }
  };
}
