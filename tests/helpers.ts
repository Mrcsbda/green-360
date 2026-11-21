/// <reference types="node" />
import customers from '@/data/fixtures/customers.json';
import sales from '@/data/fixtures/sales.json';
import trm from '@/data/fixtures/trm.json';
import type { Customer, Sale } from '@/modules/customers/domain/customer';
import { makeSaleValuer, type TrmSeries } from '@/modules/customers/domain/money';
import { buildCustomerViews, DEFAULT_RULES } from '@/modules/customers/domain/segmentation';

export const fixtureCustomers = () => structuredClone(customers) as Customer[];
export const fixtureSales = () => sales as Sale[];
export const valueCOP = makeSaleValuer(trm as TrmSeries);
export const views = (cs = fixtureCustomers(), rules = DEFAULT_RULES) => buildCustomerViews(cs, fixtureSales(), rules, valueCOP);
export const DATA_DIR = `${__dirname}/../../Green_Services_Recursos_de_Prueba/01_Datos`;
