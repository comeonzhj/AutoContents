/**
 * 小红书笔记发布服务
 *
 * 完整移植自 Python xhs 库 (https://github.com/ReaJason/xhs) 的签名算法和接口逻辑。
 *
 * 接口说明：
 * 1. GET  /api/media/v1/upload/web/permit  → 获取图片上传凭证 (file_id + token)
 * 2. PUT  https://ros-upload.xiaohongshu.com/{file_id}  → 上传图片到 COS
 * 3. POST /web_api/sns/v2/note  → 创建图文笔记（走 creator.xiaohongshu.com）
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { getConfig } = require('./configService');

const XHS_HOST = 'https://edith.xiaohongshu.com';
const XHS_CREATOR_HOST = 'https://creator.xiaohongshu.com';
const XHS_WEB = 'https://www.xiaohongshu.com';
const UPLOAD_HOST = 'https://ros-upload.xiaohongshu.com';

// ── 签名算法（精确移植自 xhs/help.py sign() 函数）──────────────────────────

const B64_LOOKUP = [
  'Z','m','s','e','r','b','B','o','H','Q','t','N','P','+','w','O',
  'c','z','a','/','L','p','n','g','G','8','y','J','q','4','2','K',
  'W','Y','j','0','D','S','f','d','i','k','x','3','V','T','1','6',
  'I','l','U','A','F','M','9','7','h','E','C','v','u','R','X','5',
];

// 自定义 Base64 编码（lookup 表与标准 Base64 不同）
function b64EncodeBytes(bytes) {
  const P = bytes.length;
  const W = P % 3;
  const parts = [];
  const z = 16383;
  let H = 0;
  const Z = P - W;

  function tripletToBase64(e) {
    return (
      B64_LOOKUP[63 & (e >> 18)] +
      B64_LOOKUP[63 & (e >> 12)] +
      B64_LOOKUP[(e >> 6) & 63] +
      B64_LOOKUP[e & 63]
    );
  }

  function encodeChunk(arr, t, r) {
    let m = '';
    for (let b = t; b < r; b += 3) {
      const n = ((arr[b] << 16) & 16711680) + ((arr[b + 1] << 8) & 65280) + (arr[b + 2] & 255);
      m += tripletToBase64(n);
    }
    return m;
  }

  while (H < Z) {
    parts.push(encodeChunk(bytes, H, H + z > Z ? Z : H + z));
    H += z;
  }
  if (W === 1) {
    const F = bytes[P - 1];
    parts.push(B64_LOOKUP[F >> 2] + B64_LOOKUP[(F << 4) & 63] + '==');
  } else if (W === 2) {
    const F = (bytes[P - 2] << 8) + bytes[P - 1];
    parts.push(B64_LOOKUP[F >> 10] + B64_LOOKUP[63 & (F >> 4)] + B64_LOOKUP[(F << 2) & 63] + '=');
  }
  return parts.join('');
}

// encodeUtf8：字符串 → UTF-8 字节数组（移植自 help.py encodeUtf8）
function encodeUtf8(str) {
  const encoded = encodeURIComponent(str).replace(/[~()*!.']/g, (c) => c);
  const bytes = [];
  let i = 0;
  while (i < encoded.length) {
    if (encoded[i] === '%') {
      bytes.push(parseInt(encoded.slice(i + 1, i + 3), 16));
      i += 3;
    } else {
      bytes.push(encoded.charCodeAt(i));
      i += 1;
    }
  }
  return bytes;
}

// mrc：CRC 校验（移植自 help.py mrc()，用于 x9 字段）
const MRC_TABLE = [
  0,1996959894,3993919788,2567524794,124634137,1886057615,3915621685,2657392035,
  249268274,2044508324,3772115230,2547177864,162941995,2125561021,3887607047,2428444049,
  498536548,1789927666,4089016648,2227061214,450548861,1843258603,4107580753,2211677639,
  325883990,1684777152,4251122042,2321926636,335633487,1661365465,4195302755,2366115317,
  997073096,1281953886,3579855332,2724688242,1006888145,1258607687,3524101629,2768942443,
  901097722,1119000684,3686517206,2898065728,853044451,1172266101,3705015759,2882616665,
  651767980,1373503546,3369554304,3218104598,565507253,1454621731,3485111705,3099436303,
  671266974,1594198024,3322730930,2970347812,795835527,1483230225,3244367275,3060149565,
  1994146192,31158534,2563907772,4023717930,1907459465,112637215,2680153253,3904427059,
  2013776290,251722036,2517215374,3775830040,2137656763,141376813,2439277719,3865271297,
  1802195444,476864866,2238001368,4066508878,1812370925,453092731,2181625025,4111451223,
  1706088902,314042704,2344532202,4240017532,1658658271,366619977,2362670323,4224994405,
  1303535960,984961486,2747007092,3569037538,1256170817,1037604311,2765210733,3554079995,
  1131014506,879679996,2909243462,3663771856,1141124467,855842277,2852801631,3708648649,
  1342533948,654459306,3188396048,3373015174,1466479909,544179635,3110523913,3462522015,
  1591671054,702138776,2966460450,3352799412,1504918807,783551873,3082640443,3233442989,
  3988292384,2596254646,62317068,1957810842,3939845945,2647816111,81470997,1943803523,
  3814918930,2489596804,225274430,2053790376,3826175755,2466906013,167816743,2097651377,
  4027552580,2265490386,503444072,1762050814,4150417245,2154129355,426522225,1852507879,
  4275313526,2312317920,282753626,1742555852,4189708143,2394877945,397917763,1622183637,
  3604390888,2714866558,953729732,1340076626,3518719985,2797360999,1068828381,1219638859,
  3624741850,2936675148,906185462,1090812512,3747672003,2825379669,829329135,1181335161,
  3412177804,3160834842,628085408,1382605366,3423369109,3138078467,570562233,1426400815,
  3317316542,2998733608,733239954,1555261956,3268935591,3050360625,752459403,1541320221,
  2607071920,3965973030,1969922972,40735498,2617837225,3943577151,1913087877,83908371,
  2512341634,3803740692,2075208622,213261112,2463272603,3855990285,2094854071,198958881,
  2262029012,4057260610,1759359992,534414190,2176718541,4139329115,1873836001,414664567,
  2282248934,4279200368,1711684554,285281116,2405801727,4167216745,1634467795,376229701,
  2685067896,3608007406,1308918612,956543938,2808555105,3495958263,1231636301,1047427035,
  2932959818,3654703836,1088359270,936918000,2847714899,3736837829,1202900863,817233897,
  3183342108,3401237130,1404277552,615818150,3134207493,3453421203,1423857449,601450431,
  3009837614,3294710456,1567103746,711928724,3020668471,3272380065,1510334235,755167117,
];

function mrc(e) {
  // JS 没有 signed right shift for 32-bit，用 >>> 模拟 ctypes.c_uint32 + 有符号结果
  function rightWithoutSign(num, bit) {
    const MAX32 = 4294967295;
    const val = ((num >>> 0) >>> bit) >>> 0;
    return ((val + MAX32 + 1) % (2 * (MAX32 + 1))) - MAX32 - 1;
  }

  let o = -1;
  for (let n = 0; n < 57; n++) {
    o = MRC_TABLE[(o & 255) ^ e.charCodeAt(n)] ^ rightWithoutSign(o, 8);
  }
  return (o ^ -1 ^ 3988292384);
}

// xhs 自定义 Base64 encode（字符串版，先 encodeUtf8 再 b64EncodeBytes）
function xhsB64Encode(str) {
  return b64EncodeBytes(encodeUtf8(str));
}

// h 函数：将 32 字符 MD5 hex 转为 xhs 自定义编码的 x-s
function h(n) {
  const d = 'A4NjFqYu5wPHsO0XTdDgMa2r1ZQocVte9UJBvk6/7=yRnhISGKblCWi+LpfE8xzm3';
  let m = '';
  for (let i = 0; i < 32; i += 3) {
    const o = n.charCodeAt(i);
    const g = i + 1 < 32 ? n.charCodeAt(i + 1) : 0;
    const hh = i + 2 < 32 ? n.charCodeAt(i + 2) : 0;
    const x = ((o & 3) << 4) | (g >> 4);
    let p = ((15 & g) << 2) | (hh >> 6);
    const v = o >> 2;
    let b = hh ? (hh & 63) : 64;
    if (!g) { p = 64; b = 64; }
    m += d[v] + d[x] + d[p] + d[b];
  }
  return m;
}

/**
 * 生成 x-s / x-t / x-s-common 签名头
 * 移植自 xhs/help.py sign()
 */
function buildXhsSign(uri, data, a1 = '') {
  const v = Date.now();
  const dataStr = (data && typeof data === 'object')
    ? JSON.stringify(data, null, 0)  // 注意 Python separators=(',',':') → 紧凑格式
    : '';

  // Python: json.dumps(data, separators=(',', ':'), ensure_ascii=False)
  // 需要紧凑无空格
  const rawStr = `${v}test${uri}${dataStr}`;
  const md5Str = crypto.createHash('md5').update(rawStr, 'utf8').digest('hex');
  const xs = h(md5Str);
  const xt = String(v);

  const common = {
    s0: 5,
    s1: '',
    x0: '1',
    x1: '3.2.0',
    x2: 'Windows',
    x3: 'xhs-pc-web',
    x4: '2.3.1',
    x5: a1,
    x6: xt,
    x7: xs,
    x8: '',
    x9: mrc(xt + xs),
    x10: 1,
  };

  const commonStr = JSON.stringify(common, null, 0);
  const xsCommon = xhsB64Encode(commonStr);

  return { 'x-s': xs, 'x-t': xt, 'x-s-common': xsCommon };
}

// ── 通用工具 ────────────────────────────────────────────────────────────────

function parseCookie(str) {
  const result = {};
  for (const part of str.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    result[part.slice(0, idx).trim()] = part.slice(idx + 1).trim();
  }
  return result;
}

function buildHeaders(cookie, extraHeaders = {}) {
  return {
    Cookie: cookie,
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/111.0.0.0 Safari/537.36',
    'Content-Type': 'application/json',
    Referer: XHS_WEB,
    Origin: XHS_WEB,
    ...extraHeaders,
  };
}

// ── 上传图片 ────────────────────────────────────────────────────────────────

/**
 * 申请上传凭证，返回 { fileId, token }
 * 对应 Python: get_upload_files_permit("image")
 */
async function getUploadPermit(cookie, a1) {
  const uri = '/api/media/v1/upload/web/permit';
  const params = 'biz_name=spectrum&scene=image&file_count=1&version=1&source=web';
  const fullUri = `${uri}?${params}`;

  const sign = buildXhsSign(fullUri, null, a1);

  const resp = await axios.get(`${XHS_HOST}${fullUri}`, {
    headers: buildHeaders(cookie, sign),
  });

  if (!resp.data?.success) {
    throw new Error(`获取上传凭证失败: ${JSON.stringify(resp.data)}`);
  }

  // 接口可能返回多个 permit（不同 qos/uploadAddr），取第一个即可
  const permit = resp.data.data.uploadTempPermits[0];
  // uploadAddr 字段决定实际上传域名（如 ros-upload-d4.xhscdn.com 或 ros-upload.xiaohongshu.com）
  const uploadAddr = permit.uploadAddr || 'ros-upload.xiaohongshu.com';
  return { fileId: permit.fileIds[0], token: permit.token, uploadAddr };
}

/**
 * 上传图片文件到 COS
 * 对应 Python: upload_file(file_id, token, file_path)
 */
async function uploadFileToCos(fileId, token, filePath, uploadAddr) {
  const ext = path.extname(filePath).slice(1).toLowerCase();
  const contentType = ext === 'jpg' ? 'image/jpeg' : `image/${ext || 'jpeg'}`;

  const fileBuffer = fs.readFileSync(filePath);
  // 使用 permit 返回的 uploadAddr（可能是 ros-upload-d4.xhscdn.com 等）
  const host = uploadAddr || 'ros-upload.xiaohongshu.com';
  const url = `https://${host}/${fileId}`;

  const resp = await axios.put(url, fileBuffer, {
    headers: {
      'X-Cos-Security-Token': token,
      'Content-Type': contentType,
    },
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
  });

  if (resp.status !== 200) {
    throw new Error(`COS 上传失败，HTTP ${resp.status}`);
  }
}

// ── 创建笔记 ────────────────────────────────────────────────────────────────

/**
 * 发布图文笔记到小红书
 *
 * 对应 Python: create_image_note(title, desc, files)
 * 接口：POST https://creator.xiaohongshu.com/web_api/sns/v2/note
 */
async function publishNote({ title, desc, imagePaths, isPrivate = false }) {
  const enabled = getConfig('xhs_enabled');
  if (enabled !== '1') throw new Error('小红书发布功能未开启，请在配置中启用');

  const cookie = getConfig('xhs_cookie');
  if (!cookie) throw new Error('未配置小红书 Cookie');

  const cookies = parseCookie(cookie);
  if (!cookies.a1 || !cookies.web_session) {
    throw new Error('Cookie 不完整，缺少 a1 或 web_session 字段，请重新获取');
  }

  if (!imagePaths || imagePaths.length === 0) {
    throw new Error('至少需要一张图片');
  }

  const a1 = cookies.a1;

  // 逐张图片：申请凭证 → 上传
  const images = [];
  for (const imgPath of imagePaths) {
    if (!fs.existsSync(imgPath)) throw new Error(`图片文件不存在: ${imgPath}`);

    const { fileId, token, uploadAddr } = await getUploadPermit(cookie, a1);
    await uploadFileToCos(fileId, token, imgPath, uploadAddr);

    images.push({
      file_id: fileId,
      metadata: { source: -1 },
      stickers: { version: 2, floating: [] },
      extra_info_json: '{"mimeType":"image/jpeg"}',
    });
  }

  // 创建笔记请求体（精确对应 Python create_note）
  const noteTitle = title.length > 20 ? title.slice(0, 20) : title;
  const businessBinds = {
    version: 1,
    noteId: 0,
    noteOrderBind: {},
    notePostTiming: { postTime: null },
    noteCollectionBind: { id: '' },
  };

  const uri = '/web_api/sns/v2/note';
  const body = {
    common: {
      type: 'normal',
      title: noteTitle,
      note_id: '',
      desc,
      source: '{"type":"web","ids":"","extraInfo":"{\\"subType\\":\\"official\\"}"}',
      business_binds: JSON.stringify(businessBinds),
      ats: [],
      hash_tag: [],
      post_loc: {},
      privacy_info: { op_type: 1, type: isPrivate ? 1 : 0 },
    },
    image_info: { images },
    video_info: null,
  };

  const sign = buildXhsSign(uri, body, a1);

  // 使用 edith.xiaohongshu.com（creator 域名该接口返回 404）
  const resp = await axios.post(
    `${XHS_HOST}${uri}`,
    JSON.stringify(body),
    {
      headers: {
        ...buildHeaders(cookie, sign),
        'Content-Type': 'application/json',
        Referer: XHS_WEB + '/',
        Origin: XHS_WEB,
      },
    }
  );

  // 成功响应：{ success: true, data: { id: '...', score: ... }, share_link: '...' }
  const data = resp.data;
  if (!data?.success) {
    const code = data?.code;
    const msg = data?.msg || JSON.stringify(data);
    if (code === -100) throw new Error('签名错误，请检查 Cookie 是否有效');
    if (code === -9999) throw new Error(`小红书暂时无法发布：${msg}`);
    throw new Error(`发布失败 (code=${code}): ${msg}`);
  }

  const noteId = data.data?.id || data.data?.note_id;
  const noteUrl = data.share_link || (noteId ? `${XHS_WEB}/discovery/item/${noteId}` : null);
  return { note_id: noteId, note_url: noteUrl };
}

module.exports = { publishNote };
