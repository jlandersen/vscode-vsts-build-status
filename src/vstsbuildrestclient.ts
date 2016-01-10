import {Settings} from './settings';
import * as rest from 'node-rest-client';

export interface Build {
    result: string;
    reason: string;
    startTime: string;
}
export interface BuildDefinition {
    id: number;
    name: string;
    revision: number;
}

export class HttpResponse<T> {
    statusCode: number;
    value: T;

    constructor(statusCode: number, value: T) {
        this.statusCode = statusCode;
        this.value = value;
    }
}

export interface VstsBuildRestClientFactory {
    createClient(settings: Settings): VstsBuildRestClient;
}

export class VstsBuildRestClientFactoryImpl implements VstsBuildRestClientFactory {
    public createClient(settings: Settings): VstsBuildRestClient {
        return new VstsBuildRestClientImplementation(settings);
    }
}

export interface VstsBuildRestClient {
    getLatest(definition: BuildDefinition): Thenable<HttpResponse<Build>>;
    getDefinitions(): Thenable<HttpResponse<BuildDefinition[]>>;
}

class VstsBuildRestClientImplementation implements VstsBuildRestClient {
    private client: any;
    private settings: Settings;

    constructor(settings: Settings) {
        this.settings = settings;
        this.client = new rest.Client();
    }

    public getLatest(definition: BuildDefinition): Thenable<HttpResponse<Build>> {
        var url = `https://${this.settings.account}.visualstudio.com/DefaultCollection/${this.settings.project}/_apis/build/builds?definitions=${definition.id}&$top=1&api-version=2.0`;
        
        return this.get<Build[]>(url).then(response => {
            if (response.value != null && response.value.length > 0) {
                return new HttpResponse(response.statusCode, response.value[0]);
            }
            
            return new HttpResponse(response.statusCode, null);
        });
    }

    public getDefinitions(): Thenable<HttpResponse<BuildDefinition[]>> {
        var url = `https://${this.settings.account}.visualstudio.com/DefaultCollection/${this.settings.project}/_apis/build/definitions?api-version=2.0`;
        
        return this.get<BuildDefinition[]>(url);
    }

    private get<T>(url: string): Thenable<HttpResponse<T>> {
        return new Promise((resolve, reject) => {
            this.client.get(
                url,
                this.getRequestArgs(),
                (data, response) => {
                    if (response.statusCode != 200) {
                        reject("Status code indicated non-OK result " + response.statusCode);
                        return;
                    }

                    var result: T;

                    try {
                        result = JSON.parse(data).value;
                    } catch (e) {
                        result = null;
                    }

                    return resolve(new HttpResponse(response.statusCode, result));
                }).on("error", error => {
                    return reject(error);
                });
        });
    }

    private getRequestArgs(): { headers: { Authorization: string } } {
        var authHeader = `Basic ${new Buffer(`${this.settings.username}:${this.settings.password}`).toString("base64")}`;

        return {
            headers: { Authorization: authHeader }
        }
    }
}