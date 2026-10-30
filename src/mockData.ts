import type { Driver, RemitoPhoto, ShiftRequest, Vehicle } from './types'

export const DRIVERS: Driver[] = [
  {
    id: 'MR',
    initials: 'MR',
    name: 'Marcelo Rodríguez',
    phone: '11 5551-9001',
    email: 'marcelo@example.com',
    status: 'Activo',
    baseRate: 65000,
    ratePerKm: 900,
    ratePerHour: 12000,
    factors: [
      { label: 'Espera por ascensor', amount: 3500 },
      { label: 'Carga frágil', amount: 6000 },
    ],
  },
  {
    id: 'HP',
    initials: 'HP',
    name: 'Hernán Pérez',
    phone: '11 5558-1230',
    email: 'hernan@example.com',
    status: 'Activo',
    baseRate: 62000,
    ratePerKm: 850,
    ratePerHour: 11000,
    factors: [
      { label: 'Estacionamiento', amount: 2500 },
      { label: 'Subida de pisos sin ascensor', amount: 4000 },
    ],
  },
  {
    id: 'JA',
    initials: 'JA',
    name: 'Jorge Almada',
    phone: '11 5550-6612',
    email: 'jorge@example.com',
    status: 'Activo',
    baseRate: 58000,
    ratePerKm: 800,
    ratePerHour: 10000,
    factors: [
      { label: 'Espera por ascensor', amount: 3000 },
      { label: 'Objetos frágiles', amount: 5000 },
    ],
  },
]

const REMITO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="210" height="297" viewBox="0 0 210 297">
<rect width="210" height="297" fill="#ffffff"/>
<rect x="10" y="10" width="190" height="277" fill="none" stroke="#c9d1da" stroke-width="2" rx="8"/>
<text x="20" y="42" font-family="Arial" font-size="16" font-weight="bold" fill="#132b4a">Fletes Express</text>
<text x="20" y="62" font-family="Arial" font-size="11" fill="#5a6b7a">Comprobante de viaje</text>
<line x1="20" y1="74" x2="190" y2="74" stroke="#e3e5e1" stroke-width="2"/>
<text x="20" y="96" font-family="Arial" font-size="12" fill="#132b4a">FEX-1048 | 24/09/2026</text>
<text x="20" y="114" font-family="Arial" font-size="12" fill="#132b4a">Origen: Armenia 1450, Palermo</text>
<text x="20" y="132" font-family="Arial" font-size="12" fill="#132b4a">Destino: Ruiz Huidobro 2500</text>
<text x="20" y="150" font-family="Arial" font-size="12" fill="#132b4a">Cliente: Kevin</text>
<line x1="20" y1="166" x2="190" y2="166" stroke="#e3e5e1" stroke-width="2"/>
<text x="20" y="188" font-family="Arial" font-size="12" fill="#5a6b7a">Firma del cliente:</text>
<line x1="20" y1="214" x2="140" y2="214" stroke="#132b4a" stroke-width="2"/>
<text x="20" y="242" font-family="Arial" font-size="14" font-weight="bold" fill="#2f7d55">ENTREGADO</text>
</svg>`

export const REMITO_SAMPLE: RemitoPhoto = {
  name: 'remito_fex1048.svg',
  dataUrl: 'data:image/svg+xml;base64,' + btoa(REMITO_SVG),
}

export const VEHICLES: Vehicle[] = [
  { id: 'MOV-01', type: 'Furgón grande', capacityKg: 1500, status: 'Disponible' },
  { id: 'MOV-04', type: 'Furgón chico', capacityKg: 500, status: 'Asignado', assignedNote: 'FEX-1047 · hasta 14:00' },
  { id: 'MOV-05', type: 'Camión mudancero', capacityKg: 3500, status: 'Disponible' },
  { id: 'MOV-07', type: 'Camión mediano', capacityKg: 2000, status: 'En taller', assignedNote: 'En taller · no asignable' },
]

export const CLIENTS = [
  { name: 'Lucía Benítez', phone: '11 4500-1287' },
  { name: 'Martín Acosta', phone: '11 3988-6201' },
  { name: 'Estudio Norte SRL', phone: '11 4702-3344' },
  { name: 'Kevin', phone: '11 3291-5140' },
]

export const REQUESTS: ShiftRequest[] = [
  {
    id: 'FEX-1048',
    client: 'Kevin',
    phone: '11 3291-5140',
    status: 'Pendiente de seña',
    date: '2026-09-24',
    arrivalRange: ['09:00', '11:00'],
    serviceRange: ['11:00', '13:00'],
    origin: { label: 'Origen', address: 'Armenia 1450', barrio: 'Palermo', floor: 'Piso 3', elevator: true },
    destination: { label: 'Destino', address: 'Ruiz Huidobro 2500', barrio: 'Saavedra', floor: 'Piso 1', elevator: false },
    cargo: {
      items: [
        { name: 'Heladera', units: 1 },
        { name: 'Sofá de 2 cuerpos, desmontable', units: 1 },
        { name: 'Cajas', units: 10 },
      ],
      approxUnits: 12,
      fragile: true,
      notes: 'Coordinar estacionamiento; sillón desmontable.',
    },
    driverId: 'JA',
    vehicleId: 'MOV-05',
    price: 185000,
    depositRequired: 92500,
    depositReceived: 0,
    estimatedKm: 18,
    estimatedHours: 2,
    arrivedAt: '2026-09-24T11:02',
    incidents: [
      {
        id: 'INC-1001',
        type: 'Demora',
        description: 'El cliente retiraba las llaves en administración; esperé unos minutos.',
        time: '2026-09-24T11:12',
      },
    ],
    remitoPhoto: REMITO_SAMPLE,
  },
  {
    id: 'FEX-1047',
    client: 'Estudio Sur',
    phone: '11 4811-5560',
    status: 'Confirmada',
    date: '2026-09-24',
    arrivalRange: ['12:00', '14:00'],
    serviceRange: ['12:00', '14:00'],
    origin: { label: 'Origen', address: 'Av. Cabildo 1800', barrio: 'Belgrano', floor: 'Planta baja', elevator: true },
    destination: { label: 'Destino', address: 'Uruguay 300', barrio: 'Recoleta', floor: 'Piso 2', elevator: true },
    cargo: {
      items: [{ name: 'Escritorios y sillas de oficina', units: 6 }],
      approxUnits: 8,
      fragile: true,
      notes: 'Retirar llaves en administración.',
    },
    driverId: 'HP',
    vehicleId: 'MOV-04',
    price: 325000,
    depositRequired: 162500,
    depositReceived: 162500,
    confirmed: true,
  },
  {
    id: 'FEX-1046',
    client: 'Marta Ríos',
    phone: '11 6112-7789',
    status: 'Confirmada',
    date: '2026-09-24',
    arrivalRange: ['08:00', '10:00'],
    serviceRange: ['10:00', '12:00'],
    origin: { label: 'Origen', address: 'Av. Corrientes 5200', barrio: 'Villa Crespo', floor: 'Piso 2', elevator: true },
    destination: { label: 'Destino', address: 'Fitz Roy 2100', barrio: 'Caballito', floor: 'Piso 1', elevator: false },
    cargo: {
      items: [{ name: 'Muebles de living', units: 5 }],
      approxUnits: 6,
      fragile: false,
      notes: 'Disponer de lugar para estacionar frente al edificio.',
    },
    driverId: 'MR',
    vehicleId: 'MOV-01',
    price: 240000,
    depositRequired: 120000,
    depositReceived: 120000,
    confirmed: true,
  },
  {
    id: 'FEX-1049',
    client: 'Tomás Vidal',
    phone: '11 6103-4422',
    status: 'Pendiente de revisión',
    date: '2026-09-26',
    arrivalRange: ['09:00', '11:00'],
    serviceRange: ['10:00', '12:00'],
    origin: { label: 'Origen', address: 'Av. Medrano 700', barrio: 'Almagro', floor: 'Piso 5', elevator: true },
    destination: { label: 'Destino', address: 'Av. San Martín 5900', barrio: 'Villa Devoto', floor: 'Piso 1', elevator: true },
    cargo: {
      items: [{ name: 'Heladera y cajas', units: 7 }],
      approxUnits: 8,
      fragile: true,
      notes: 'Ingreso por el pasillo lateral.',
    },
    price: 0,
    depositRequired: 0,
    depositReceived: 0,
  },
  {
    id: 'FEX-1044',
    client: 'Paula Sosa',
    phone: '11 5120-9913',
    status: 'Cancelada',
    date: '2026-09-20',
    arrivalRange: ['14:00', '16:00'],
    serviceRange: ['14:00', '16:00'],
    origin: { label: 'Origen', address: 'Quesada 3300', barrio: 'Núñez', floor: 'Piso 3', elevator: true },
    destination: { label: 'Destino', address: 'Av. Cabildo 980', barrio: 'Colegiales', floor: 'Piso 1', elevator: true },
    cargo: {
      items: [{ name: 'Cajas y bolsos', units: 9 }],
      approxUnits: 9,
      fragile: false,
      notes: 'Cancelada por el cliente.',
    },
    price: 0,
    depositRequired: 0,
    depositReceived: 0,
  },
]

export const DAY_AGENDA = REQUESTS.filter((r) => r.date === '2026-09-24')

export function getRequest(id: string): ShiftRequest {
  return REQUESTS.find((r) => r.id.toLowerCase() === id.toLowerCase()) ?? REQUESTS[0]
}

export const driverById = (id?: string): Driver | undefined => DRIVERS.find((d) => d.id === id)
export const vehicleById = (id?: string): Vehicle | undefined => VEHICLES.find((v) => v.id === id)

export function hasConflict(driverId?: string, serviceRange?: [string, string], excludeId?: string): boolean {
  if (!driverId || !serviceRange) return false
  const [start, end] = serviceRange
  return REQUESTS.some((r) => {
    if (r.id === excludeId || !r.confirmed) return false
    if (r.driverId !== driverId) return false
    const [s2, e2] = r.serviceRange
    return start < e2 && s2 < end
  })
}

export interface EarningsLine {
  label: string
  value: number
}

export function tripEarnings(d: Driver, km = 0, hours = 0): { lines: EarningsLine[]; total: number } {
  const lines: EarningsLine[] = [
    { label: 'Tarifa base por viaje', value: d.baseRate },
    { label: `Recorrido · ${km} km`, value: km * d.ratePerKm },
    { label: `Tiempo · ${hours} h`, value: hours * d.ratePerHour },
    ...d.factors.map((f) => ({ label: f.label, value: f.amount })),
  ]
  const total = lines.reduce((a, l) => a + l.value, 0)
  return { lines, total }
}