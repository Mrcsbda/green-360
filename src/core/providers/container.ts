// Composición: el único lugar que conoce las implementaciones concretas.
import { hybridInsightsService } from '@/modules/ai-insights/infrastructure/hybridInsightsService';
import { localAuthService } from '@/modules/auth/infrastructure/localAuthService';
import { createCustomerService } from '@/modules/customers/application/customerService';
import { customerRepository, saleRepository, settingsRepository, trmRepository } from '@/modules/customers/infrastructure/repositories';
import { createImportService } from '@/modules/imports/application/importService';
import { pickSpreadsheet, saveFile } from '@/modules/imports/infrastructure/fileIO';
import { sheetJsCodec } from '@/modules/imports/infrastructure/spreadsheet';
import { consultationRepository, licenseRepository, trainingRepository } from '@/modules/services/servicesRepositories';

const customers = customerRepository();
const sales = saleRepository();
const settings = settingsRepository();

export const container = {
  auth: localAuthService,
  customerService: createCustomerService({ customers, sales, trm: trmRepository, settings }),
  importService: createImportService({ customers, sales, files: { pick: pickSpreadsheet, save: saveFile }, codec: sheetJsCodec }),
  insights: hybridInsightsService,
  trainings: trainingRepository(),
  licenses: licenseRepository(),
  consultations: consultationRepository(),
};
