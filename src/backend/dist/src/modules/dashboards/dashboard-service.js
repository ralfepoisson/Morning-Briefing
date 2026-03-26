export class DashboardService {
    repository;
    constructor(repository) {
        this.repository = repository;
    }
    async listForOwner(ownerUserId) {
        const dashboards = await this.repository.listForOwner(ownerUserId);
        return dashboards.map(toResponse);
    }
    async create(input) {
        const name = normalizeName(input.name);
        if (!name) {
            throw new Error('Dashboard name is required.');
        }
        const dashboard = await this.repository.create({
            ...input,
            name,
            description: normalizeDescription(input.description),
            theme: normalizeTheme(input.theme)
        });
        return toResponse(dashboard);
    }
    async update(input) {
        const name = normalizeName(input.name);
        if (!name) {
            throw new Error('Dashboard name is required.');
        }
        const dashboard = await this.repository.update({
            ...input,
            name,
            description: normalizeDescription(input.description)
        });
        return dashboard ? toResponse(dashboard) : null;
    }
    async archive(input) {
        return this.repository.archive(input);
    }
}
function normalizeName(value) {
    return value.trim();
}
function normalizeDescription(value) {
    return (value || '').trim();
}
function normalizeTheme(value) {
    return (value || 'aurora').trim() || 'aurora';
}
function toResponse(dashboard) {
    return {
        id: dashboard.id,
        name: dashboard.name,
        description: dashboard.description,
        theme: dashboard.theme,
        isGenerating: dashboard.isGenerating,
        createdAt: dashboard.createdAt.toISOString(),
        updatedAt: dashboard.updatedAt.toISOString()
    };
}
