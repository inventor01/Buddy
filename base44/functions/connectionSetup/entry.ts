import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { secrets } from 'base44:runtime';
import { orchestrationReadiness } from '../../shared/orchestrator.ts';

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

    const abilities = await Promise.all(Object.entries(values).map(async ([key, connectorId]) => {
      let connected = false;
      if (connectorId) {
        try {
          await base44.asServiceRole.connectors.getCurrentAppUserConnection(connectorId);
          connected = true;
        } catch (_) {
          connected = false;
        }
      }
      return {
        key,
        ready: !!connectorId,
        connected,
        connectorId,
      };
    }));

    return Response.json({
      property_data_ready: !!secrets.get('RENTCAST_API_KEY'),
      phone_verification_ready: !!secrets.get('TWILIO_ACCOUNT_SID') && !!secrets.get('TWILIO_AUTH_TOKEN') && !!secrets.get('TWILIO_FROM_NUMBER'),
      specialists: orchestrationReadiness(),
      abilities,
    });
  } catch (error: any) {
    return Response.json({ error: String(error?.message || error) }, { status: 500 });
  }
}