import {
    ContentTypeModels,
    ManagementClient,
    TaxonomyModels,
    ContentTypeSnippetModels
} from '@kontent-ai/management-sdk';

import {
    handleError,
    defaultRetryStrategy,
    printProjectAndEnvironmentInfoToConsoleAsync,
    defaultHttpService,
    IJsonContentType,
    IJsonContentTypeSnippet,
    IJsonTaxonomy
} from '../core';
import { IImportConfig, IImportedData, ITargetEnvironmentData } from './import.models';
import { logDebug } from '../core/log-helper';
import { importContentTypesHelper } from './helpers/import-content-types.helper';
import { IExportJson } from '../export';
import { importContentTypeSnippetsHelper } from './helpers/import-content-type-snippets.helper';
import { importTaxonomiesHelper } from './helpers/import-taxonomies.helper';

export class ImportService {
    private readonly managementClient: ManagementClient;

    constructor(config: IImportConfig) {
        this.managementClient = new ManagementClient({
            apiKey: config.apiKey,
            baseUrl: config.baseUrl,
            environmentId: config.environmentId,
            httpService: defaultHttpService,
            retryStrategy: config.retryStrategy ?? defaultRetryStrategy
        });
    }

    async importAsync(data: {
        exportJson: IExportJson;
        selectedContentTypes: string[];
        selectedTaxonomies: string[];
        selectedContentTypeSnippets: string[];
    }): Promise<IImportedData> {
        const importedData: IImportedData = {
            contentTypes: [],
            contentTypeSnippets: [],
            taxonomies: []
        };

        const dataToImport = this.getDataToImport(data);

        await printProjectAndEnvironmentInfoToConsoleAsync(this.managementClient);
        const existingData = await this.getTargetEnvironmentDataAsync();

        try {
            //  Taxonomies
            if (dataToImport.taxonomies.length) {
                logDebug({
                    type: 'Info',
                    message: 'Importing taxonomies',
                    partA: dataToImport.taxonomies.length.toString()
                });
                const importedTaxonomies = await importTaxonomiesHelper.importTaxonomiesAsync({
                    managementClient: this.managementClient,
                    existingData: existingData,
                    importTaxonomies: dataToImport.taxonomies
                });
                importedData.taxonomies.push(...importedTaxonomies);
            } else {
                logDebug({
                    type: 'Skip',
                    message: 'There are no taxonomies to import'
                });
            }

            //  Content type snippets
            if (dataToImport.contentTypeSnippets.length) {
                logDebug({
                    type: 'Info',
                    message: 'Importing content type snippets',
                    partA: dataToImport.contentTypeSnippets.length.toString()
                });

                const importedContentTypeSnippets =
                    await importContentTypeSnippetsHelper.importContentTypeSnipppetsAsync({
                        managementClient: this.managementClient,
                        existingData: existingData,
                        importContentTypeSnippets: dataToImport.contentTypeSnippets
                    });
                importedData.contentTypeSnippets.push(...importedContentTypeSnippets);
            } else {
                logDebug({
                    type: 'Skip',
                    message: 'There are no content type snippets to import'
                });
            }

            //  Content types
            if (dataToImport.contentTypes.length) {
                logDebug({
                    type: 'Info',
                    message: 'Importing content types',
                    partA: dataToImport.contentTypes.length.toString()
                });
                const importedContentTypes = await importContentTypesHelper.importContentTypesAsync({
                    managementClient: this.managementClient,
                    existingData: existingData,
                    importContentTypes: dataToImport.contentTypes
                });
                importedData.contentTypes.push(...importedContentTypes);
            } else {
                logDebug({
                    type: 'Skip',
                    message: 'There are no content types to import'
                });
            }

            logDebug({
                type: 'Info',
                message: 'Importing taxonomies',
                partA: dataToImport.taxonomies.length.toString()
            });
            logDebug({
                type: 'Info',
                message: 'Import finished'
            });
        } catch (error) {
            handleError(error);
        }
        return importedData;
    }

    private getDataToImport(data: {
        exportJson: IExportJson;
        selectedContentTypes: string[];
        selectedTaxonomies: string[];
        selectedContentTypeSnippets: string[];
    }): {
        contentTypes: IJsonContentType[];
        contentTypeSnippets: IJsonContentTypeSnippet[];
        taxonomies: IJsonTaxonomy[];
    } {
        const contentTypesToImport: IJsonContentType[] = [];
        const contentTypeSnippetsToImport: IJsonContentTypeSnippet[] = [];
        const taxonomiesToImport: IJsonTaxonomy[] = [];

        // filter content types
        if (data.selectedContentTypes.length === 0) {
            contentTypesToImport.push(...data.exportJson.contentTypes);
        } else {
            for (const selectedContentTypeCodename of data.selectedContentTypes) {
                const foundContentType = data.exportJson.contentTypes.find(
                    (m) => m.codename.toLowerCase() === selectedContentTypeCodename.toLocaleLowerCase()
                );

                if (foundContentType) {
                    contentTypesToImport.push(foundContentType);
                } else {
                    logDebug({
                        type: 'Warning',
                        message: `Could not find content type with given codename`,
                        partA: selectedContentTypeCodename
                    });
                }
            }
        }

        // filter content type snippets
        if (data.selectedContentTypeSnippets.length === 0) {
            contentTypeSnippetsToImport.push(...data.exportJson.contentTypeSnippets);
        } else {
            for (const selectedContentTypeSnippetCodename of data.selectedContentTypeSnippets) {
                const foundContentTypeSnippet = data.exportJson.contentTypeSnippets.find(
                    (m) => m.codename.toLowerCase() === selectedContentTypeSnippetCodename.toLocaleLowerCase()
                );

                if (foundContentTypeSnippet) {
                    contentTypeSnippetsToImport.push(foundContentTypeSnippet);
                } else {
                    logDebug({
                        type: 'Warning',
                        message: `Could not find content type snippet with given codename`,
                        partA: selectedContentTypeSnippetCodename
                    });
                }
            }
        }

        // filter taxonomies
        if (data.selectedTaxonomies.length === 0) {
            taxonomiesToImport.push(...data.exportJson.taxonomies);
        } else {
            for (const selectedTaxonomyCodename of data.selectedTaxonomies) {
                const foundTaxonomy = data.exportJson.taxonomies.find(
                    (m) => m.codename.toLowerCase() === selectedTaxonomyCodename.toLocaleLowerCase()
                );

                if (foundTaxonomy) {
                    taxonomiesToImport.push(foundTaxonomy);
                } else {
                    logDebug({
                        type: 'Warning',
                        message: `Could not find taxonomy with given codename`,
                        partA: selectedTaxonomyCodename
                    });
                }
            }
        }

        return {
            contentTypes: contentTypesToImport,
            contentTypeSnippets: contentTypeSnippetsToImport,
            taxonomies: taxonomiesToImport
        };
    }

    private async getTargetEnvironmentDataAsync(): Promise<ITargetEnvironmentData> {
        const contentTypes: ContentTypeModels.ContentType[] = (
            await this.managementClient.listContentTypes().toAllPromise()
        ).data.items;

        logDebug({
            type: 'Fetch',
            message: 'Fetched existing content types',
            partA: contentTypes.length.toString()
        });

        const contentTypeSnippets: ContentTypeSnippetModels.ContentTypeSnippet[] = (
            await this.managementClient.listContentTypeSnippets().toAllPromise()
        ).data.items;

        logDebug({
            type: 'Fetch',
            message: 'Fetched existing content type snippets',
            partA: contentTypeSnippets.length.toString()
        });

        const taxonomies: TaxonomyModels.Taxonomy[] = (await this.managementClient.listTaxonomies().toAllPromise()).data
            .items;

        logDebug({
            type: 'Fetch',
            message: 'Fetched existing taxonomies',
            partA: taxonomies.length.toString()
        });

        return {
            contentTypes: contentTypes,
            contentTypeSnippets: contentTypeSnippets,
            taxonomies: taxonomies
        };
    }
}
