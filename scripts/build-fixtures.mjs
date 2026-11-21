// Genera src/data/fixtures/*.json a partir de los CSV del reto.
// Contacto, correo y teléfono no vienen en los datos: quedan vacíos para que el usuario los complete o los importe.
import fs from 'node:fs';
import path from 'node:path';

const SRC = process.argv[2] ?? '../Green_Services_Recursos_de_Prueba/01_Datos';
const OUT = 'src/data/fixtures';
const read = (f) => {
  const [h, ...rows] = fs.readFileSync(path.join(SRC, f), 'utf8').replace(/^\uFEFF/, '').trim().split(/\r?\n/);
  const keys = h.split(',');
  return rows.map((l) => Object.fromEntries(l.split(',').map((v, i) => [keys[i], v])));
};

const customers = read('clientes.csv').map((c) => ({
  id: c.cliente_id,
  empresa: c.nombre_prueba,
  ciudad: c.ciudad_prueba,
  sector: c.sector_prueba,
  contacto: '',
  email: '',
  telefono: '',
  canal: c.canal_preferido_prueba,
  fechaAlta: c.fecha_alta,
}));

const productos = Object.fromEntries(read('productos.csv').map((p) => [p.producto_id, p.nombre_prueba]));
const sales = read('ventas.csv').map((v) => ({
  id: v.venta_id,
  fecha: v.fecha,
  customerId: v.cliente_id,
  producto: productos[v.producto_id] ?? v.producto_id,
  cantidad: Number(v.cantidad),
  moneda: v.moneda,
  precioUnitario: Number(v.precio_unitario),
  estado: v.estado,
}));
const trm = read('trm_prueba.csv').map((t) => [t.fecha, Number(t.cop_por_usd)]);

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(`${OUT}/customers.json`, JSON.stringify(customers));
fs.writeFileSync(`${OUT}/sales.json`, JSON.stringify(sales));
fs.writeFileSync(`${OUT}/trm.json`, JSON.stringify(trm));
console.log(`customers ${customers.length}, sales ${sales.length}, trm ${trm.length}`);
