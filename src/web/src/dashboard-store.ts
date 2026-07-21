export interface Widget {
  id: string;
  dashboardId: string;
  type: string;
  title: string;
  x: number;
  y: number;
  width: number;
  height: number;
  minWidth?: number;
  minHeight?: number;
  config: Record<string, unknown>;
  data: Record<string, unknown>;
  includeInBriefingDefault?: boolean;
  includeInBriefingOverride?: boolean | null;
  includeInBriefing?: boolean;
  errorMessage?: string;
  generatedAt?: string;
}

interface Snapshot {
  widgets?: Array<{
    widgetId: string;
    content?: Record<string, unknown>;
    generatedAt?: string;
    errorMessage?: string | null;
  }>;
}

export class DashboardStore {
  private widgets: Widget[];

  constructor(widgets: Widget[] = []) {
    this.widgets = widgets.map(cloneWidget);
  }

  list(): Widget[] {
    return this.widgets;
  }

  replace(widgets: Widget[]): void {
    this.widgets = widgets.map(cloneWidget);
  }

  get(id: string): Widget | undefined {
    return this.widgets.find((widget) => widget.id === id);
  }

  add(widget: Widget): void {
    this.widgets.push(cloneWidget(widget));
  }

  updateLayout(id: string, layout: Pick<Widget, 'x' | 'y' | 'width' | 'height'>): void {
    Object.assign(this.get(id) ?? {}, layout);
  }

  applySnapshot(snapshot: Snapshot | null): void {
    for (const widget of this.widgets) {
      const result = snapshot?.widgets?.find((entry) => entry.widgetId === widget.id);
      if (result?.content) {
        widget.data = result.content;
      }
      widget.generatedAt = result?.generatedAt ?? '';
      widget.errorMessage = result?.errorMessage ?? '';
    }
  }
}

function cloneWidget(widget: Widget): Widget {
  return structuredClone(widget);
}
