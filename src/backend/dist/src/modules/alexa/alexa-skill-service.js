export class AlexaSkillService {
    dashboardService;
    dashboardBriefingService;
    constructor(dashboardService, dashboardBriefingService) {
        this.dashboardService = dashboardService;
        this.dashboardBriefingService = dashboardBriefingService;
    }
    async getDailyBriefing(user) {
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
