import appInsights = require("applicationinsights");
import Client = require("applicationinsights/out/Library/Client");
import {Settings} from "./Settings";

const config = {
    appId: "b2c90c9e-b236-4f9b-87a7-d9fed021d2bf"
};

export class AppInsightsClientProvider {
    private static client: Client;

    public static start(settings: Settings) {
        appInsights
            .setup(config.appId)
            .setAutoCollectPerformance(false)
            .setAutoCollectConsole(false)
            .setAutoCollectDependencies(false)
            .setAutoCollectExceptions(false)
            .setAutoCollectRequests(false)
            .setAutoDependencyCorrelation(false)
            .start();
        
        this.registerClient(settings);
        settings.onDidChangeSettings(() => {
            AppInsightsClientProvider.client.config.disableAppInsights = !settings.telemetryEnabled
        });
    }

    private static registerClient(settings: Settings) {
        let client = appInsights.getClient(config.appId);
        
        // Remove logging of machine name and device ID
        delete client.context.tags["ai.cloud.roleInstance"];
        delete client.context.tags["ai.device.id"];
        
        client.config.disableAppInsights = !settings.telemetryEnabled;
        AppInsightsClientProvider.client = client;
    }

    public static getAppInsightsClient(): Client {
        return AppInsightsClientProvider.client;
    }
}