/* 把 src/shell.html + src/css + src/js 拼回 artifact-fragment.html 的文本（需求单 #1）。
 * 占位行 `<!-- @include 相对路径 -->` 整行（连同它的换行）替换成文件内容，文件内容自带末尾换行。
 * ART / AUDIO 两段在 shell 里只有 BEGIN / END，由 build-src 接着注入。 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export function hasShell(srcDir){ return existsSync(join(srcDir, 'shell.html')); }

export function assemble(srcDir){
  const shell = readFileSync(join(srcDir, 'shell.html'), 'utf8');
  return shell.replace(/^<!-- @include (\S+) -->\r?\n/gm, (_, rel) => {
    const p = join(srcDir, rel);
    if (!existsSync(p)) throw new Error(`shell.html 引用的 ${rel} 不存在`);
    return readFileSync(p, 'utf8');
  });
}
