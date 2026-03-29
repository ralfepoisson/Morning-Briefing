import type { DefaultUserContext } from '../default-user/default-user-service.js';
import type { DashboardBriefingService } from '../dashboard-briefings/dashboard-briefing-service.js';
import type { DashboardService } from '../dashboards/dashboard-service.js';

export type AlexaDailyBriefingResult =
  | {
    status: 'ready';
    dashboardId: string;
    dashboardName: string;
    briefingId: string;
    generatedAt: string | null;
    scriptText: string;
  }
  | {
    status: 'missing_dashboard';
  }
  | {
    status: 'missing_briefing';
    dashboardId: string;
    dashboardName: string;
  };

export class AlexaSkillService {
  constructor(
    private readonly dashboardService: Pick<DashboardService, 'listForOwner'>,
    private readonly dashboardBriefingService: Pick<DashboardBriefingService, 'getLatestBriefing'>
  ) {}

  async getDailyBriefing(user: DefaultUserContext): Promise<AlexaDailyBriefingResult> {
    const dashboards = await this.dashboardService.listForOwner(user.userId);
    const dashboard = dashboards[0];

    if (!dashboard) {
      return {
        status: 'missing_dashboard'
      };
    }

    const briefing = await this.dashboardBriefingService.getLatestBriefing(dashboard.id, user);

    if (!briefing || briefing.status !== 'READY' || !briefing.scriptText.trim()) {
      return {
        status: 'missing_briefing',
        dashboardId: dashboard.id,
        dashboardName: dashboard.name
      };
    }

    return {
      status: 'ready',
      dashboardId: dashboard.id,
      dashboardName: dashboard.name,
      briefingId: briefing.id,
      generatedAt: briefing.generatedAt,
      scriptText: briefing.scriptText.trim()
    };
  }
}
