import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { secrets } from 'base44:runtime';

export default async function(req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const values = {
      gmail: secrets.get('GMAIL_APP_USER_CONNECTOR_ID') || '',
      calendar: secrets.get('GOOGLE_CALENDAR_APP_USER_CONNECTOR_ID') || '',
      tasks: secrets.get('GOOGLE_TASKS_APP_USER_CONNECTOR_ID') || '',
    };

    return Response.json({
      property_data_ready: !!secrets.get('RENTCAST_API_KEY'),
      abilities: Object.entries(values).map(([key, connectorId]) => ({
        key,
        ready: !!connectorId,
        connectorId,
      })),
    });
  } catch (error: any) {
    return Response.json({ error: String(error?.message || error) }, { status: 500 });
  }
}