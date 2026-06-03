// 工具函数模块

/**
 * 简单的密码哈希函数（SHA-256）
 * 注意：这只是前端的基本保护，真正的安全需要后端支持
 */
export async function hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
}

/**
 * RGB 转 Hex
 */
export function rgbToHex(rgb) {
    if (rgb.startsWith('#')) return rgb;
    const sep = rgb.indexOf(",") > -1 ? "," : " ";
    const rgbArr = rgb.substr(4).split(")")[0].split(sep);
    let r = (+rgbArr[0]).toString(16), g = (+rgbArr[1]).toString(16), b = (+rgbArr[2]).toString(16);
    if (r.length == 1) r = "0" + r; if (g.length == 1) g = "0" + g; if (b.length == 1) b = "0" + b;
    return "#" + r + g + b;
}

/**
 * 获取 HSL 颜色字符串
 */
export function getHslColorString(index) {
    return `hsl(${(index * 12) % 360}, 70%, 50%)`;
}

