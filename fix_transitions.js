const fs = require('fs');
const path = 'src/app/pages/ProgramEditor.tsx';
const fullPath = require('path').resolve(__dirname, path);

console.log(`Reading from ${fullPath}`);
try {
    let content = fs.readFileSync(fullPath, 'utf8');

    // Replacements
    const replacements = [
        { regex: /<SelectItem value="fade">.*?<\/SelectItem>/, val: '<SelectItem value="fade">✨ Fade</SelectItem>' },
        { regex: /<SelectItem value="slide-left">.*?<\/SelectItem>/, val: '<SelectItem value="slide-left">⬅️ Slide Left</SelectItem>' },
        { regex: /<SelectItem value="slide-right">.*?<\/SelectItem>/, val: '<SelectItem value="slide-right">➡️ Slide Right</SelectItem>' },
        { regex: /<SelectItem value="zoom">.*?<\/SelectItem>/, val: '<SelectItem value="zoom">🔍 Zoom</SelectItem>' }
    ];

    let updated = content;
    replacements.forEach(r => {
        if (updated.match(r.regex)) {
            updated = updated.replace(r.regex, r.val);
            console.log(`Fixed ${r.val}`);
        } else {
            console.log(`Could not match regex for ${r.val}`);
        }
    });

    fs.writeFileSync(fullPath, updated, 'utf8');
    console.log('Update complete.');
} catch (e) {
    console.error("Error:", e);
}
