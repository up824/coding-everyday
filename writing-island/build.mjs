// 把 src/ 里的文件拼成两个成品：
//   index.html          独立网页（可放到任何静态托管上，支持“添加到主屏幕”和离线）
//   dist/artifact.html  发布到 Claude Artifact 用的页面片段
//   dist/app.html 和 ios/WritingIsland.swiftpm/Page.swift
//                       iPadOS App 外壳里显示的页面（同一份内容，以 Swift 字符串的形式编进 App）
// 用法：node build.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const read = (f) => readFileSync(join(root, 'src', f), 'utf8');

const css = read('style.css');
const body = read('body.html');
const js = ['glyphs.js', 'engine.js', 'store.js', 'audio.js', 'board.js', 'app.js'].map(read).join('\n');
if (/<\/script/i.test(js)) throw new Error('脚本里不能出现 </script');

const TITLE = '写字岛';

const artifact = `<title>${TITLE}</title>
<meta name="claude:viewport-fit-sides" content="cover">
<style>
${css}</style>
${body}
<script>
${js}</script>
`;

const standalone = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover,user-scalable=no,maximum-scale=1">
<title>${TITLE}</title>
<meta name="description" content="用 Apple Pencil 练习写数字和英文字母的闯关小游戏">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<meta name="apple-mobile-web-app-title" content="${TITLE}">
<meta name="theme-color" content="#E4F3FF">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" href="icons/icon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="icons/icon-180.png">
<style>:root{padding:env(safe-area-inset-top,0px) 0 env(safe-area-inset-bottom,0px)}body{margin:0}[hidden]{display:none!important}</style>
<style>
${css}</style>
</head>
<body>
${body}
<script>
${js}</script>
<script>
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () {}); });
}
</script>
</body>
</html>
`;

// App 外壳用的页面：不需要清单、主屏幕图标和离线缓存（这些由 App 自己负责）
const appPage = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover,user-scalable=no,maximum-scale=1">
<title>${TITLE}</title>
<style>:root{padding:env(safe-area-inset-top,0px) 0 env(safe-area-inset-bottom,0px)}body{margin:0}[hidden]{display:none!important}</style>
<style>
${css}</style>
</head>
<body>
${body}
<script>
${js}</script>
</body>
</html>
`;
// 页面会放进 Swift 的原始字符串 ###"""…"""### 里，所以内容里不能出现它的结束标记或转义前缀
const CLOSE = '"' + '"' + '"###';
if (appPage.includes(CLOSE) || appPage.includes('\\###')) throw new Error('页面里出现了 Swift 原始字符串的结束标记');
const swift = `// 由 build.mjs 生成，不要手改：改 src/ 里的文件，然后运行 node build.mjs。
// 内容是整个网页，编进 App 里，所以 App 不联网也能用。

let pageHTML: String = ###"""
${appPage}${CLOSE}
`;

mkdirSync(join(root, 'dist'), { recursive: true });
mkdirSync(join(root, 'ios', 'WritingIsland.swiftpm'), { recursive: true });
writeFileSync(join(root, 'dist', 'app.html'), appPage);
writeFileSync(join(root, 'ios', 'WritingIsland.swiftpm', 'Page.swift'), swift);
writeFileSync(join(root, 'dist', 'artifact.html'), artifact);
writeFileSync(join(root, 'index.html'), standalone);
console.log(`index.html ${(standalone.length / 1024).toFixed(0)} KB · dist/artifact.html ${(artifact.length / 1024).toFixed(0)} KB · ios/…/Page.swift ${(swift.length / 1024).toFixed(0)} KB`);
