// Composición: el único lugar que conoce las implementaciones concretas.
import { env } from '@/core/config/env';
import { firebaseEnabled } from '@/core/firebase/config';
import { createHttpInsightsService } from '@/modules/ai-insights/infrastructure/httpInsightsService';
import { rulesInsightsService } from '@/modules/ai-insights/infrastructure/rulesInsightsService';
import { firebaseAuthService } from '@/modules/auth/infrastructure/firebaseAuthService';
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
  storage: firebaseEnabled ? ('firebase' as const) : ('local' as const),
  auth: firebaseEnabled ? firebaseAuthService : localAuthService,
  customerService: createCustomerService({ customers, sales, trm: trmRepository, settings }),
  importService: createImportService({ customers, sales, files: { pick: pickSpreadsheet, save: saveFile }, codec: sheetJsCodec }),
  insights: env.aiMode === 'connected' && env.aiApiUrl ? createHttpInsightsService(env.aiApiUrl) : rulesInsightsService,
  trainings: trainingRepository(),
  licenses: licenseRepository(),
  consultations: consultationRepository(),
};
