const fs = require('fs');
const path = require('path');

const targetPath = path.resolve(__dirname, 'src/app/pages/ProgramEditor.tsx');

console.log(`Reading from ${targetPath}`);
try {
    let content = fs.readFileSync(targetPath, 'utf8');

    // Replacements
    const replacements = [
        { regex: /<SelectItem value="fade">.*?<\/SelectItem>/, val: '<SelectItem value="fade">✨ Fade</SelectItem>' },
        { regex: /<SelectItem value="slide-left">.*?<\/SelectItem>/, val: '<SelectItem value="slide-left">⬅️ Slide Left</SelectItem>' },
        { regex: /<SelectItem value="slide-right">.*?<\/SelectItem>/, val: '<SelectItem value="slide-right">➡️ Slide Right</SelectItem>' },
        { regex: /<SelectItem value="zoom">.*?<\/SelectItem>/, val: '<SelectItem value="zoom">🔍 Zoom</SelectItem>' }
    ];

    let updated = content;
    let fixCount = 0;
    replacements.forEach(r => {
        if (updated.match(r.regex)) {
            updated = updated.replace(r.regex, r.val);
            console.log(`Fixed ${r.val}`);
            fixCount++;
        } else {
            console.log(`Could not match regex for ${r.val}`);
        }
    });

    if (fixCount > 0) {
        fs.writeFileSync(targetPath, updated, 'utf8');
        console.log('Update complete.');
    } else {
        console.log('No changes needed or regex failed.');
    }

} catch (e) {
    console.error("Error:", e);
}
