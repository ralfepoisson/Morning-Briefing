import type { FastifyInstance, FastifyRequest } from 'fastify';
import { getPrismaClient } from '../../infrastructure/prisma/prisma-client.js';
import { createDashboardBriefingService } from '../dashboard-briefings/dashboard-briefing-runtime.js';
import type { DashboardBriefingService } from '../dashboard-briefings/dashboard-briefing-service.js';
import { DefaultUserService } from '../default-user/default-user-service.js';
import { PrismaDashboardRepository } from '../dashboards/prisma-dashboard-repository.js';
import { DashboardService } from '../dashboards/dashboard-service.js';
import { AlexaSkillService } from './alexa-skill-service.js';

type AlexaEnvelope = {
  version?: string;
  session?: {
    application?: {
      applicationId?: string;
    };
    user?: {
      accessToken?: string;
    };
  };
  context?: {
    System?: {
      application?: {
        applicationId?: string;
      };
      user?: {
        accessToken?: string;
      };
    };
  };
  request?: {
    type?: string;
    intent?: {
      name?: string;
    };
  };
};

export type AlexaSkillRouteDependencies = {
  defaultUserService: Pick<DefaultUserService, 'getDefaultUser'>;
  alexaSkillService: Pick<AlexaSkillService, 'getDailyBriefing'>;
  applicationId: string | null;
};

export async function registerAlexaSkillRoutes(
  app: FastifyInstance,
  dependencies: AlexaSkillRouteDependencies = createAlexaSkillRouteDependencies()
): Promise<void> {
  app.post('/api/v1/integrations/alexa', async function handleAlexaRequest(request, reply) {
    const body = (request.body || {}) as AlexaEnvelope;
    const requestType = body.request?.type || '';
    const intentName = body.request?.intent?.name || '';
    const requestApplicationId = readAlexaApplicationId(body);

    if (dependencies.applicationId && requestApplicationId !== dependencies.applicationId) {
      reply.code(403);
      return {
        message: 'Alexa skill application id is not allowed.'
      };
    }

    if (requestType === 'SessionEndedRequest') {
      return buildResponse('Goodbye.', true);
    }

    if (requestType === 'LaunchRequest') {
      return buildResponse(
        'Welcome to Morning Briefing. Ask me for your daily briefing when you are ready.',
        false,
        'You can say, give me my daily briefing.'
      );
    }

    if (requestType === 'IntentRequest' && intentName === 'AMAZON.HelpIntent') {
      return buildResponse(
        'You can say, give me my daily briefing, and I will read the latest saved briefing from your default dashboard.',
        false,
        'Try saying, give me my daily briefing.'
      );
    }

    if (requestType === 'IntentRequest' && (intentName === 'AMAZON.StopIntent' || intentName === 'AMAZON.CancelIntent')) {
      return buildResponse('Goodbye.', true);
    }

    if (requestType !== 'IntentRequest' || intentName !== 'GetDailyBriefingIntent') {
      return buildResponse(
        'I can help with your daily briefing. Say, give me my daily briefing.',
        false,
        'Say, give me my daily briefing.'
      );
    }

    const accessToken = readAlexaAccessToken(body);

    if (!accessToken) {
      return buildLinkAccountResponse(
        'Please link your Morning Briefing account in the Alexa app before asking for your daily briefing.'
      );
    }

    const user = await dependencies.defaultUserService.getDefaultUser({
      headers: {
        authorization: `Bearer ${accessToken}`
      }
    } as FastifyRequest);
    const result = await dependencies.alexaSkillService.getDailyBriefing(user);

    if (result.status === 'missing_dashboard') {
      return buildResponse(
        'I could not find a dashboard for your account yet. Please create a dashboard in Morning Briefing first.',
        true
      );
    }

    if (result.status === 'missing_briefing') {
      return buildResponse(
        `Your ${result.dashboardName} daily briefing is not ready yet. Please try again in a little while.`,
        true
      );
    }

    return buildResponse(result.scriptText, true, undefined, {
      title: 'Morning Briefing',
      content: result.scriptText
    });
  });
}

function createAlexaSkillRouteDependencies(): AlexaSkillRouteDependencies {
  const prisma = getPrismaClient();
  const dashboardBriefingService = createDashboardBriefingService();
  const dashboardService = new DashboardService(new PrismaDashboardRepository(prisma));

  return {
    defaultUserService: new DefaultUserService(prisma),
    alexaSkillService: new AlexaSkillService(dashboardService, dashboardBriefingService),
    applicationId: normalizeEnv(process.env.ALEXA_SKILL_APPLICATION_ID)
  };
}

function readAlexaAccessToken(body: AlexaEnvelope): string | null {
  const token = body.context?.System?.user?.accessToken || body.session?.user?.accessToken;

  return typeof token === 'string' && token.trim() ? token.trim() : null;
}

function readAlexaApplicationId(body: AlexaEnvelope): string | null {
  const applicationId = body.context?.System?.application?.applicationId || body.session?.application?.applicationId;

  return typeof applicationId === 'string' && applicationId.trim() ? applicationId.trim() : null;
}

function normalizeEnv(value: string | undefined): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function buildResponse(
  text: string,
  shouldEndSession: boolean,
  repromptText?: string,
  card?: {
    title: string;
    content: string;
  }
) {
  return {
    version: '1.0',
    response: {
      outputSpeech: {
        type: 'PlainText',
        text
      },
      reprompt: repromptText
        ? {
          outputSpeech: {
            type: 'PlainText',
            text: repromptText
          }
        }
        : undefined,
      card: card
        ? {
          type: 'Simple',
          title: card.title,
          content: card.content
        }
        : undefined,
      shouldEndSession
    }
  };
}

function buildLinkAccountResponse(text: string) {
  return {
    version: '1.0',
    response: {
      outputSpeech: {
        type: 'PlainText',
        text
      },
      card: {
        type: 'LinkAccount'
      },
      shouldEndSession: true
    }
  };
}
