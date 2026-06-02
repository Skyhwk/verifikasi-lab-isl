import CryptoJS from 'crypto-js';

const SLICE_VERSION = 'v1';

/** Legacy mapping — jangan ganti ke AES tanpa migrasi data. */
const legacyData = {
    a: 'ssp8',
    b: 's21s48',
    c: 'xopA8',
    d: 'poxik8',
    e: 'Tak8',
    f: 'MkNixy8',
    g: 'IdPN8',
    h: 'OtuYx8',
    i: 'OtiX8',
    j: 'Z23x8',
    k: 'Zaee8',
    l: 'Rx38',
    m: 'R418',
    n: 'CapR8',
    o: 'Mui8',
    p: 'DtBy8',
    q: 'YxBi8',
    r: 'BiBG8',
    s: 'muxYb8',
    t: 'MZx8',
    u: 'mnz8',
    v: 'mzn8',
    w: 'MnCC8',
    x: 'BnM8',
    y: 'BVc8',
    z: 'BBc8',
    A: 'AAxY8',
    B: 'IojX8',
    C: 'XFhG8',
    D: 'XH8',
    E: 'xG8',
    F: 'GGJj8',
    G: 'Dx8',
    H: 'PR8',
    I: 'ER8',
    J: 'losp8',
    K: 'Hgk8',
    L: 'Jh8',
    M: 'Oxlao8',
    N: 'OOyx8',
    O: 'o00xY8',
    P: '0xP18',
    Q: '0xP8',
    R: 'sd208',
    S: 'JS08',
    T: 'KC8',
    U: 'qYkW8',
    V: 'qqQw8',
    W: 'Yuxq8',
    X: 'UUixYY8',
    Y: 'WWppxY8',
    Z: 'pxWW8',
    0: 'iiiY8',
    1: 'dxUYY8',
    2: 'SxTy8',
    3: 'G98',
    4: 'YuuI8',
    5: 'xITY8',
    6: 'DSYC8',
    7: 'CS28',
    8: 'PCSR8',
    9: 'OOS8',
    s_PPX1: 'S8',
    ',': 'sadP8',
    '.': 'xpsd198',
    '[': 'DTxDTp8',
    ']': 'OPOP18',
    '(': 'PlIcq8',
    ')': 'FPOSx8',
    "'": '4PxxX8',
    '"': 'DSTe8',
    '\\': 'KaMP8',
    '?': 'XPOS8',
    ':': 'DPs8',
    ';': 'TE38',
    '{': 'xYaD8',
    '}': 'xXDD918',
};

const inids = (string, decode = false) => {
    if (decode) {
        const key = Object.keys(legacyData).find(k => legacyData[k] === string);
        return key || string;
    }
    return legacyData[string] || string;
};

const getSliceKey = () => {
    const raw = process.env.NEXT_PUBLIC_SLICE_SECRET || 'orang kuat orang yang sabar';
    if (!raw) {
        throw new Error('NEXT_PUBLIC_SLICE_SECRET is not configured');
    }

    if (raw.startsWith('base64:')) {
        const key = CryptoJS.enc.Base64.parse(raw.slice(7));

        if (key.sigBytes !== 32) {
            throw new Error('NEXT_PUBLIC_SLICE_SECRET base64 value must decode to 32 bytes');
        }

        return key;
    }

    return CryptoJS.SHA256(raw);
};

const validateSliceTimestamp = payload => {
    const ttl = parseInt(process.env.NEXT_PUBLIC_SLICE_TTL || '300', 10);
    const now = Math.floor(Date.now() / 1000);

    if (!payload || typeof payload.ts !== 'number') {
        throw new Error('Invalid slice payload');
    }

    if (Math.abs(now - payload.ts) > ttl) {
        throw new Error('Slice expired');
    }
};

const encryptSlice = input => {
    if (input === '') {
        return input;
    }

    const key = getSliceKey();
    const iv = CryptoJS.lib.WordArray.random(16);
    const encrypted = CryptoJS.AES.encrypt(input, key, {
        iv,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7,
    });

    return `${SLICE_VERSION}.${CryptoJS.enc.Base64.stringify(iv.concat(encrypted.ciphertext))}`;
};

const decryptSlice = (input, validateTtl = true) => {
    if (input === '') {
        return input;
    }

    const prefix = `${SLICE_VERSION}.`;
    if (!input.startsWith(prefix)) {
        throw new Error('Unsupported slice format');
    }

    const raw = CryptoJS.enc.Base64.parse(input.slice(prefix.length));
    if (raw.sigBytes < 17) {
        throw new Error('Invalid slice payload');
    }

    const iv = CryptoJS.lib.WordArray.create(raw.words.slice(0, 4), 16);
    const ciphertext = CryptoJS.lib.WordArray.create(raw.words.slice(4), raw.sigBytes - 16);
    const decrypted = CryptoJS.AES.decrypt({ ciphertext }, getSliceKey(), {
        iv,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7,
    });

    const plaintext = decrypted.toString(CryptoJS.enc.Utf8);
    if (!plaintext) {
        throw new Error('Slice decryption failed');
    }

    const payload = JSON.parse(plaintext);
    if (validateTtl) {
        validateSliceTimestamp(payload);
    }

    return plaintext;
};

/** Legacy encrypt. Bukan untuk X-Slice. */
const encrypt = input => {
    if (input === '') {
        return input;
    }

    let result = '';
    for (const char of input) {
        if (char === ' ') {
            result += inids('s_PPX1');
        } else {
            result += inids(char);
        }
    }
    return result;
};

/** Legacy decrypt. Bukan untuk X-Slice. */
const decrypt = input => {
    if (input === '') {
        return input;
    }

    const parts = input.split('8').filter(part => part !== '');
    let result = '';
    for (const part of parts) {
        let value = inids(part + '8', true);
        if (value === 's_PPX1') {
            value = ' ';
        }
        result += value;
    }
    return result;
};

export { encrypt, decrypt, encryptSlice, decryptSlice };
