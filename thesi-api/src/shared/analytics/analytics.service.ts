import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as mixpanel from 'mixpanel';

type AnalyticsProperties = Record<string, unknown>;

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);
  private readonly app = 'thesi_api';
  private readonly environment: string;
  private readonly posthogKey: string;
  private readonly posthogHost: string;
  private readonly mixpanelClient?: mixpanel.Mixpanel;

  constructor(private readonly config: ConfigService) {
    this.environment =
      this.config.get<string>('APP_ENV') ||
      this.config.get<string>('NODE_ENV') ||
      'development';
    this.posthogKey =
      this.config.get<string>('POSTHOG_KEY') ||
      this.config.get<string>('NEXT_PUBLIC_POSTHOG_KEY') ||
      '';
    this.posthogHost =
      this.config.get<string>('POSTHOG_HOST') || 'https://us.i.posthog.com';

    const mixpanelToken = this.config.get<string>('MIXPANEL_TOKEN') || '';
    if (mixpanelToken) {
      this.mixpanelClient = mixpanel.init(mixpanelToken, {
        debug: this.config.get<string>('ANALYTICS_DEBUG') === 'true',
      });
    }
  }

  track(
    eventName: string,
    distinctId: string,
    properties: AnalyticsProperties = {},
  ): void {
    const payload = this.cleanProperties({
      app: this.app,
      environment: this.environment,
      distinct_id: distinctId,
      ...properties,
    });

    if (this.mixpanelClient) {
      this.mixpanelClient.track(eventName, payload, (error) => {
        if (error) this.logger.warn(`Mixpanel ${eventName} failed: ${error.message}`);
      });
    }

    if (this.posthogKey) {
      void this.capturePostHog(eventName, payload);
    }
  }

  private async capturePostHog(
    eventName: string,
    properties: AnalyticsProperties,
  ) {
    try {
      const response = await fetch(
        `${this.posthogHost.replace(/\/$/, '')}/capture/`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            api_key: this.posthogKey,
            event: eventName,
            properties,
          }),
        },
      );
      if (!response.ok) {
        this.logger.warn(`PostHog ${eventName} failed: HTTP ${response.status}`);
      }
    } catch (error) {
      this.logger.warn(
        `PostHog ${eventName} failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  private cleanProperties(properties: AnalyticsProperties) {
    return Object.fromEntries(
      Object.entries(properties).filter(([, value]) => value !== undefined),
    );
  }
}
