#!/usr/bin/env node
import { readFileSync } from 'fs';
import * as yargs from 'yargs';

import { ICliFileConfig, CliAction, extractErrorMessage } from '../../core';
import { ExportService } from '../../export';
import { ImportService } from '../../import';
import { FileProcessorService } from '../../file-processor';
import { FileService } from '../file/file.service';
import { logDebug } from '../../core/log-helper';
import { getAcceleratorDataService } from '../../data/accelerator-data.service';

const argv = yargs(process.argv.slice(2))
    .example(
        'kda --action=export --apiKey=xxx --environmentId=xxx',
        'Creates json export of content model from given environment'
    )
    .alias('e', 'environmentId')
    .describe('e', 'environmentId')
    .alias('k', 'apiKey')
    .describe('k', 'Management API Key')
    .alias('a', 'action')
    .describe('a', 'Action to perform. One of: "export" | "removeImport" | "fileImport"')
    .alias('b', 'baseUrl')
    .describe('b', 'Custom base URL for Management API calls.')
    .alias('f', 'filename')
    .describe('f', 'Import / export filename')
    .alias('p', 'project')
    .describe('p', 'Codename of the remote project')
    .alias('ct', 'contentTypes')
    .describe('ct', 'Used to import only selected of content types')
    .alias('cts', 'contentTypeSnippets')
    .describe('cts', 'Used to import only selected of content type snippets')
    .alias('t', 'taxonomies')
    .describe('t', 'Used to import only selected of taxonomies')
    .help('h')
    .alias('h', 'help').argv;

const listRemoteProjectsAsync = async () => {
    const acceleratorDataService = getAcceleratorDataService();
    const acceleratorProjects = await acceleratorDataService.getAcceleratorProjectsAsync();

    logDebug({
        type: 'Fetch',
        message: `Fetched remote projects`,
        partA: acceleratorProjects.length.toString()
    });

    for (const project of acceleratorProjects) {
        logDebug({
            type: `List`,
            message: `${project.system.name}`,
            partA: project.system.codename
        });
    }

    logDebug({
        type: 'Complete',
        message: `All projects listed`
    });
};

const exportAsync = async (config: ICliFileConfig) => {
    if (!config.environmentId) {
        throw Error('Invalid environmentId');
    }
    if (!config.apiKey) {
        throw Error('Invalid apiKey');
    }

    const filename: string = getDefaultFilename(config.filename);
    const fileProcessorService = new FileProcessorService();
    const exportService = new ExportService({
        environmentId: config.environmentId,
        apiKey: config.apiKey,
        baseUrl: config.baseUrl
    });

    const fileService = new FileService();
    const exportedData = await exportService.exportAllAsync();

    await fileService.writeFileAsync(filename, await fileProcessorService.mapExportToJsonAsync(exportedData));

    logDebug({
        type: 'Complete',
        message: `Export finished successfully`
    });
};

const importFromFile = async (config: ICliFileConfig) => {
    const filename: string = getDefaultFilename(config.filename);
    const fileProcessorService = new FileProcessorService();
    const fileService = new FileService();

    if (!config.environmentId) {
        throw Error('Invalid environmentId');
    }
    if (!config.apiKey) {
        throw Error('Invalid apiKey');
    }

    const importService = new ImportService({
        baseUrl: config.baseUrl,
        environmentId: config.environmentId,
        apiKey: config.apiKey
    });

    const itemsFile = await fileService.loadFileAsync(filename);
    const extractedData = await fileProcessorService.extractJsonFileAsync(itemsFile);
    await importService.importAsync({
        exportJson: extractedData,
        selectedContentTypes: config.contentTypes ?? [],
        selectedContentTypeSnippets: config.contentTypeSnippets ?? [],
        selectedTaxonomies: config.taxonomies ?? []
    });

    logDebug({
        type: 'Complete',
        message: `Import finished successfully`
    });
};

const importFromRemoteAsync = async (config: ICliFileConfig) => {
    if (!config.environmentId) {
        throw Error('Invalid environmentId');
    }
    if (!config.apiKey) {
        throw Error('Invalid apiKey');
    }
    if (!config.remoteProject) {
        throw Error('Invalid remoteProject');
    }

    const acceleratorDataService = getAcceleratorDataService();
    const importService = new ImportService({
        baseUrl: config.baseUrl,
        environmentId: config.environmentId,
        apiKey: config.apiKey
    });

    logDebug({
        type: 'Fetch',
        message: `Downloading template`,
        partA: config.remoteProject
    });

    const project = await acceleratorDataService.getAcceleratorProjectByCodenameAsync(config.remoteProject);
    const exportJson = await acceleratorDataService.extractJsonFromProjectAsync(project);

    await importService.importAsync({
        exportJson: exportJson,
        selectedContentTypes: config.contentTypes ?? [],
        selectedContentTypeSnippets: config.contentTypeSnippets ?? [],
        selectedTaxonomies: config.taxonomies ?? []
    });

    logDebug({
        type: 'Complete',
        message: `Import finished successfully`
    });
};

const run = async () => {
    const config = await getConfig();

    if (config.action === 'export') {
        await exportAsync(config);
    } else if (config.action === 'fileImport') {
        await importFromFile(config);
    } else if (config.action === 'remoteImport') {
        await importFromRemoteAsync(config);
    } else if (config.action === 'list') {
        await listRemoteProjectsAsync();
    } else {
        throw Error(`Invalid action`);
    }
};

const getDefaultFilename = (filename: string | undefined) => {
    return filename ?? 'kontent-ai-export.json';
};

const getConfig = async () => {
    const resolvedArgs = await argv;
    const configFilename: string = (await resolvedArgs.config) as string;

    if (configFilename) {
        // get config from file
        const configFile = readFileSync(`./${configFilename}`);
        return JSON.parse(configFile.toString()) as ICliFileConfig;
    }

    const action: CliAction | undefined = resolvedArgs.action as CliAction | undefined;
    const apiKey: string | undefined = resolvedArgs.apiKey as string | undefined;
    const environmentId: string | undefined = resolvedArgs.environmentId as string | undefined;
    const baseUrl: string | undefined = resolvedArgs.baseUrl as string | undefined;
    const filename: string | undefined = getDefaultFilename(resolvedArgs.filename as string | undefined);

    if (!action) {
        throw Error(`No action was provided`);
    }

    // get config from command line
    const config: ICliFileConfig = {
        action,
        apiKey,
        environmentId,
        baseUrl: baseUrl,
        filename: filename
    };

    return config;
};

run()
    .then((m) => {})
    .catch((err) => {
        logDebug({
            type: 'Error',
            message: extractErrorMessage(err)
        });
    });
