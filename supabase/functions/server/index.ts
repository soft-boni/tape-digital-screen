
import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import { createClient } from "npm:@supabase/supabase-js";
import * as kv from "./kv_store.tsx";

const app = new Hono();

// Enable CORS for Vercel deployment
app.use("*", cors({
  origin: [
    "http://localhost:5173",
    "https://tape-screen.vercel.app",
    "https://tape-screen-*.vercel.app" // Preview deployments
  ],
  credentials: true,
}));
app.use("*", logger(console.log));

const BASE_PATH = "/make-server-31bfbcca";

// Public endpoints that don't require authentication
const PUBLIC_ENDPOINTS = [
  `${BASE_PATH}/devices/register`,  // Player registration
  `${BASE_PATH}/devices/:id/status` // Player status polling
];

// Skip auth check for public endpoints
app.use("*", async (c, next) => {
  const path = c.req.path;

  // Check if this is a public endpoint
  const isPublic = PUBLIC_ENDPOINTS.some(pattern => {
    if (pattern.includes(':id')) {
      const regex = new RegExp(pattern.replace(':id', '[^/]+'));
      return regex.test(path);
    }
    return path === pattern;
  });

  if (isPublic) {
    console.log('Public endpoint accessed:', path);
    return await next();
  }

  // For protected endpoints, verify auth (optional - implement if needed)
  return await next();
});

// Helper to get Supabase Client
const getSupabase = () => {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
};

// Helper to extract device name from User-Agent
function extractDeviceName(userAgent: string): string {
  if (userAgent.includes('Android')) return 'Android Device';
  if (userAgent.includes('iPad')) return 'iPad';
  if (userAgent.includes('iPhone')) return 'iPhone';
  if (userAgent.includes('Windows')) return 'Windows PC';
  if (userAgent.includes('Macintosh') || userAgent.includes('Mac OS')) return 'Mac';
  if (userAgent.includes('Linux')) return 'Linux Device';
  if (userAgent.includes('Smart-TV') || userAgent.includes('SmartTV')) return 'Smart TV';
  if (userAgent.includes('PlayStation')) return 'PlayStation';
  if (userAgent.includes('Xbox')) return 'Xbox';
  return `Device ${Math.floor(Math.random() * 1000)}`;
}

// Generate consistent PIN from IP address
function generatePinFromIP(ipAddress: string): string {
  // Create hash from IP
  const hash = ipAddress.split('').reduce((acc, char) => {
    return acc + char.charCodeAt(0);
  }, 0);

  // Generate 6-digit PIN (consistent for same IP)
  const pin = (hash % 900000 + 100000).toString();
  return pin;
}

// --- Storage Helper ---
async function ensureBucket(bucketName: string) {
  const supabase = getSupabase();
  const { data: buckets } = await supabase.storage.listBuckets();
  const exists = buckets?.some((b) => b.name === bucketName);
  if (!exists) {
    await supabase.storage.createBucket(bucketName, {
      public: false,
      fileSizeLimit: 52428800, // 50MB
    });
  }
}

// --- Content Routes ---

// List Content
app.get(`${BASE_PATH}/content`, async (c) => {
  try {
    const keys = await kv.getByPrefix("content:");
    // kv.getByPrefix returns array of values? No, instructions say "mget and getByPrefix return an array of values."
    // Let's assume it returns the values directly.
    return c.json(keys);
  } catch (e) {
    console.error(e);
    return c.json({ error: e.message }, 500);
  }
});

// Create Content Metadata
app.post(`${BASE_PATH}/content`, async (c) => {
  try {
    const body = await c.req.json();
    const id = crypto.randomUUID();
    const newContent = { ...body, id, createdAt: new Date().toISOString() };
    await kv.set(`content:${id}`, newContent);
    return c.json(newContent);
  } catch (e) {
    console.error(e);
    return c.json({ error: e.message }, 500);
  }
});

// Get Signed Upload URL
app.post(`${BASE_PATH}/storage/sign`, async (c) => {
  try {
    const { fileName, fileType } = await c.req.json();
    const bucketName = "make-31bfbcca-content";
    await ensureBucket(bucketName);

    const supabase = getSupabase();
    const path = `${crypto.randomUUID()}-${fileName}`;
    const { data, error } = await supabase.storage
      .from(bucketName)
      .createSignedUploadUrl(path);

    if (error) throw error;

    // Return upload URL and path. Read URL will be generated after upload.
    return c.json({ uploadUrl: data.signedUrl, path, token: data.token });
  } catch (e) {
    console.error(e);
    return c.json({ error: e.message }, 500);
  }
});

// Get Signed Read URL for existing file
app.post(`${BASE_PATH}/storage/read-url`, async (c) => {
  try {
    const { path } = await c.req.json();
    const bucketName = "make-31bfbcca-content";
    const supabase = getSupabase();

    const { data, error } = await supabase.storage
      .from(bucketName)
      .createSignedUrl(path, 60 * 60 * 24 * 365); // 1 year

    if (error) throw error;

    return c.json({ readUrl: data.signedUrl });
  } catch (e) {
    console.error(e);
    return c.json({ error: e.message }, 500);
  }
});


// --- Screen Routes ---

// List Screens
app.get(`${BASE_PATH}/screens`, async (c) => {
  try {
    const screens = await kv.getByPrefix("screen:");
    return c.json(screens);
  } catch (e) {
    console.error(e);
    return c.json({ error: e.message }, 500);
  }
});

// Get Screen
app.get(`${BASE_PATH}/screens/:id`, async (c) => {
  try {
    const id = c.req.param("id");
    const screen = await kv.get(`screen:${id}`);
    if (!screen) return c.json({ error: "Not found" }, 404);
    return c.json(screen);
  } catch (e) {
    console.error(e);
    return c.json({ error: e.message }, 500);
  }
});

// Create Screen
app.post(`${BASE_PATH}/screens`, async (c) => {
  try {
    const body = await c.req.json();
    const id = crypto.randomUUID();
    const newScreen = {
      ...body,
      id,
      content: [], // Array of content IDs or objects
      createdAt: new Date().toISOString()
    };
    await kv.set(`screen:${id}`, newScreen);
    return c.json(newScreen);
  } catch (e) {
    console.error(e);
    return c.json({ error: e.message }, 500);
  }
});

// Update Screen (e.g. add content)
app.put(`${BASE_PATH}/screens/:id`, async (c) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();
    const existing = await kv.get(`screen:${id}`);
    if (!existing) return c.json({ error: "Not found" }, 404);

    const updated = { ...existing, ...body };
    await kv.set(`screen:${id}`, updated);
    return c.json(updated);
  } catch (e) {
    console.error(e);
    return c.json({ error: e.message }, 500);
  }
});

// Delete Screen
app.delete(`${BASE_PATH}/screens/:id`, async (c) => {
  try {
    const id = c.req.param("id");
    await kv.del(`screen:${id}`);
    // Optional: unassign devices
    const devices = await kv.getByPrefix("device:");
    for (const device of devices) {
      if (device.screenId === id) {
        await kv.set(`device:${device.id}`, { ...device, screenId: null });
      }
    }
    return c.json({ success: true });
  } catch (e) {
    console.error(e);
    return c.json({ error: e.message }, 500);
  }
});


// --- Device Routes ---

// SIMPLE PIN GENERATION - Device calls this
app.post(`${BASE_PATH}/player/register`, async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const { ipAddress } = body;

    console.log('=== Device Registration ===');
    console.log('IP:', ipAddress);

    // Generate unique PIN in BB8A-SDE7 format (alphanumeric)
    let pin = '';
    let attempts = 0;
    const allDevices = await kv.getByPrefix("device:");
    const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

    while (attempts < 10) {
      const part1 = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
      const part2 = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
      pin = `${part1}-${part2}`;
      const pinExists = allDevices.some(d => d.pin === pin);
      if (!pinExists) break;
      attempts++;
    }

    if (!pin) {
      return c.json({ error: 'Failed to generate unique PIN' }, 500);
    }

    // Create device with activated=false
    const deviceId = crypto.randomUUID();
    const userAgent = c.req.header('user-agent') || 'Unknown';
    const deviceName = extractDeviceName(userAgent);

    const newDevice = {
      id: deviceId,
      pin,
      name: deviceName,
      activated: false,  // ⭐ Simple boolean
      ipAddress,
      screenId: null,
      createdAt: new Date().toISOString(),
      activatedAt: null,
      lastSeen: new Date().toISOString()
    };

    await kv.set(`device:${deviceId}`, newDevice);
    console.log('Device created with PIN:', pin, 'ID:', deviceId);

    return c.json({ pin, activated: false });
  } catch (e) {
    console.error('Registration error:', e);
    return c.json({ error: e.message }, 500);
  }
});

// CHECK ACTIVATION STATUS - Player polls this
app.get(`${BASE_PATH}/player/status`, async (c) => {
  try {
    const pin = c.req.query('pin');
    if (!pin) {
      return c.json({ error: 'PIN required' }, 400);
    }

    const allDevices = await kv.getByPrefix("device:");
    const device = allDevices.find(d => d.pin === pin);

    if (!device) {
      return c.json({ error: 'Device not found' }, 404);
    }

    // Update last seen
    device.lastSeen = new Date().toISOString();
    await kv.set(`device:${device.id}`, device);

    // Return activation status and content if activated
    let content = [];
    if (device.activated && device.screenId) {
      const screen = await kv.get(`screen:${device.screenId}`);
      if (screen) {
        content = screen.content || [];
      }
    }

    return c.json({
      activated: device.activated,
      screenId: device.screenId,
      content,
      accountName: device.accountName || 'User',
      deviceName: device.name || 'Display Device'
    });
  } catch (e) {
    console.error(e);
    return c.json({ error: e.message }, 500);
  }
});

// Heartbeat / Status (Player calls this)
app.get(`${BASE_PATH}/devices/:id/status`, async (c) => {
  try {
    const id = c.req.param("id");
    const device = await kv.get(`device:${id}`);
    if (!device) return c.json({ error: "Not found" }, 404);

    // Update last seen WITHOUT changing status
    // CRITICAL: Do NOT overwrite 'pending' status to 'online'!
    // Only mark as 'online' if already active
    const updated = {
      ...device,
      lastSeen: new Date().toISOString()
      // Do NOT set status here - preserve whatever it was (pending/active)
    };
    await kv.set(`device:${id}`, updated);

    // If assigned to a screen, fetch screen details
    let screen = null;
    if (device.screenId) {
      screen = await kv.get(`screen:${device.screenId}`);
    }

    return c.json({ device: updated, screen });
  } catch (e) {
    console.error(e);
    return c.json({ error: e.message }, 500);
  }
});

// ACTIVATE DEVICE - Admin calls this
app.post(`${BASE_PATH}/devices/activate`, async (c) => {
  try {
    const body = await c.req.json();
    const { pin, name } = body;

    if (!pin) {
      return c.json({ error: 'PIN is required' }, 400);
    }

    console.log('=== Device Activation ===');
    console.log('PIN:', pin);

    // Find device by PIN
    const allDevices = await kv.getByPrefix("device:");
    const device = allDevices.find(d => d.pin === pin);

    if (!device) {
      return c.json({ error: 'Invalid PIN' }, 404);
    }

    if (device.activated) {
      return c.json({ error: 'Device already activated' }, 400);
    }

    // Activate device
    device.activated = true;
    device.activatedAt = new Date().toISOString();

    // Store account name from authenticated user
    const authHeader = c.req.header('Authorization');
    if (authHeader) {
      try {
        const token = authHeader.replace('Bearer ', '');
        const { data: { user } } = await supabase.auth.getUser(token);
        if (user) {
          device.accountName = user.email?.split('@')[0] || 'User';
        }
      } catch (e) {
        console.log('Could not get user info:', e);
        device.accountName = 'User';
      }
    } else {
      device.accountName = 'User';
    }

    if (name && name.trim()) {
      device.name = name.trim();
    }

    await kv.set(`device:${device.id}`, device);
    console.log('Device activated:', device.id, device.name, 'Account:', device.accountName);

    return c.json({ success: true, device });
  } catch (error) {
    console.error('Activation error:', error);
    return c.json({ error: error.message }, 500);
  }
});

// List Devices (Admin)
app.get(`${BASE_PATH}/devices`, async (c) => {
  try {
    const devices = await kv.getByPrefix("device:");
    return c.json(devices);
  } catch (e) {
    console.error(e);
    return c.json({ error: e.message }, 500);
  }
});

// Claim Device (Admin)
app.post(`${BASE_PATH}/devices/claim`, async (c) => {
  try {
    const { pin, name } = await c.req.json();
    const devices = await kv.getByPrefix("device:");
    const device = devices.find((d: any) => d.pin === pin && d.status === "pending");

    if (!device) {
      return c.json({ error: "Invalid PIN or device not found" }, 400);
    }

    const updated = { ...device, name, status: "online", pin: null }; // Clear PIN after claim
    await kv.set(`device:${device.id}`, updated);
    return c.json(updated);
  } catch (e) {
    console.error(e);
    return c.json({ error: e.message }, 500);
  }
});

// Update Device (Assign screen, etc)
app.put(`${BASE_PATH}/devices/:id`, async (c) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();
    const device = await kv.get(`device:${id}`);
    if (!device) return c.json({ error: "Not found" }, 404);

    const updated = { ...device, ...body };
    await kv.set(`device:${id}`, updated);
    return c.json(updated);
  } catch (e) {
    console.error(e);
    return c.json({ error: e.message }, 500);
  }
});

// Delete Device
app.delete(`${BASE_PATH}/devices/:id`, async (c) => {
  try {
    const id = c.req.param("id");
    await kv.del(`device:${id}`);
    return c.json({ success: true });
  } catch (e) {
    console.error(e);
    return c.json({ error: e.message }, 500);
  }
});

// Stats
app.get(`${BASE_PATH}/dashboard/stats`, async (c) => {
  try {
    const screens = await kv.getByPrefix("screen:");
    const devices = await kv.getByPrefix("device:");
    const content = await kv.getByPrefix("content:");

    const onlineDevices = devices.filter((d: any) => {
      const lastSeen = new Date(d.lastSeen).getTime();
      const now = new Date().getTime();
      return (now - lastSeen) < 60000; // 1 minute threshold
    });

    return c.json({
      screensCount: screens.length,
      devicesCount: devices.length,
      onlineDevicesCount: onlineDevices.length,
      contentCount: content.length
    });
  } catch (e) {
    console.error(e);
    return c.json({ error: e.message }, 500);
  }
});

Deno.serve(app.fetch);
