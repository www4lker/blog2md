const fs = require('fs');
const xml2js = require('xml2js');
const sanitize = require('sanitize-filename');
const TurndownService = require('turndown');
const turndownService = new TurndownService();
const args = process.argv.slice(2);

if (args.length < 3) {
    console.error('Uso: node index.js b|w <ARQUIVO DE BACKUP XML> <DIRETÓRIO DE SAÍDA> [m|s] [paragraph-fix]');
    process.exit(1);
}

const type = args[0];
const inputFile = args[1];
const outputDir = args[2];
const commentsFlag = args[3] || 's';
const paragraphFix = args.includes('paragraph-fix');

if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
} else {
    console.warn(`AVISO: O diretório de saída "${outputDir}" já existe. Os arquivos serão sobrescritos.`);
}

function readXMLFile(filePath, callback) {
    fs.readFile(filePath, (err, data) => {
        if (err) {
            console.error(`Erro ao ler o arquivo: ${err.message}`);
            process.exit(1);
        }
        const parser = new xml2js.Parser();
        parser.parseString(data, (err, result) => {
            if (err) {
                console.error(`Erro ao converter XML para JSON: ${err.message}`);
                process.exit(1);
            }
            callback(result);
        });
    });
}

function processPosts(entries) {
    console.info(`Total de entradas encontradas: ${entries.length}`);
    entries.forEach((entry, index) => {
        try {
            const post = extractPostDetails(entry, index);
            if (post) {
                savePostToFile(post);
            }
        } catch (e) {
            console.error(`Erro ao processar a entrada: ${e.message}`);
        }
    });
}

function extractPostDetails(entry, index) {
    const titleElement = entry.title && entry.title[0];
    let title = typeof titleElement === 'string' ? titleElement : titleElement ? titleElement._ : undefined;
    
    const contentElement = entry.content && entry.content[0];
    const content = typeof contentElement === 'string' ? contentElement : contentElement ? contentElement._ : '';

    const published = entry.published && entry.published[0] ? entry.published[0] : '';
    const updated = entry.updated && entry.updated[0] ? entry.updated[0] : '';
    const categories = entry.category ? entry.category.map(cat => cat.$.term) : [];

    if (!title || typeof title !== 'string') {
        console.warn(`Post sem título detectado. Usando título padrão. Índice: ${index}`);
        title = `Sem Título ${index}`;
    }

    const postName = sanitize(title);
    const postFileName = `${outputDir}/${postName}.md`;

    const markdownContent = turndownService.turndown(content);

    return {
        title,
        published,
        updated,
        categories,
        markdownContent,
        postFileName
    };
}

function savePostToFile(post) {
    const frontMatter = `---
title: "${post.title}"
date: ${post.published}
draft: false
tags:
${post.categories.map(cat => `- ${cat}`).join('\n')}
---
${post.markdownContent}`;

    fs.writeFileSync(post.postFileName, frontMatter);
    console.info(`Post salvo em ${post.postFileName}`);
}

readXMLFile(inputFile, (result) => {
    const entries = result.feed.entry;
    processPosts(entries);
});
