
// @ts-nocheck
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
  `${BASE_PATH}/player/register`,  // Player registration
  `${BASE_PATH}/player/status`,     // Player status polling
  `${BASE_PATH}/devices/:id/status` // Device status polling (legacy)
];

// Skip auth check for public endpoints
app.use("*", async (c, next) => {
  const path = c.req.path;

  // Log all incoming paths for debugging
  console.log('Incoming request path:', path);
  console.log('Full URL:', c.req.url);

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

// Update Content (e.g., rename)
app.put(`${BASE_PATH}/content/:id`, async (c) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();
    const existing = await kv.get(`content:${id}`);
    if (!existing) return c.json({ error: "Content not found" }, 404);

    const updated = { ...existing, ...body };
    await kv.set(`content:${id}`, updated);
    return c.json(updated);
  } catch (e) {
    console.error(e);
    return c.json({ error: e.message }, 500);
  }
});

// Delete Content
app.delete(`${BASE_PATH}/content/:id`, async (c) => {
  try {
    const id = c.req.param("id");
    const content = await kv.get(`content:${id}`);
    if (!content) return c.json({ error: "Content not found" }, 404);

    // Delete from KV store
    await kv.del(`content:${id}`);

    // Optional: Remove from screens that reference this content
    const screens = await kv.getByPrefix("screen:");
    for (const screen of screens) {
      if (screen.content && screen.content.some(c => c.id === id || c.contentId === id)) {
        const updatedContent = screen.content.filter(c => c.id !== id && c.contentId !== id);
        await kv.set(`screen:${screen.id}`, { ...screen, content: updatedContent });
      }
    }

    return c.json({ success: true });
  } catch (e) {
    console.error(e);
    return c.json({ error: e.message }, 500);
  }
});

// Get Signed Upload URL
app.post(`${BASE_PATH}/storage/sign`, async (c) => {
  try {
    const { fileName, fileType } = await c.req.json();

    if (!fileName || !fileType) {
      return c.json({ error: 'fileName and fileType are required' }, 400);
    }

    const bucketName = "make-31bfbcca-content";
    await ensureBucket(bucketName);

    const supabase = getSupabase();
    const path = `${crypto.randomUUID()}-${fileName}`;
    const { data, error } = await supabase.storage
      .from(bucketName)
      .createSignedUploadUrl(path);

    if (error) {
      console.error('Storage sign error:', error);
      throw error;
    }

    if (!data || !data.signedUrl) {
      console.error('Storage sign returned null data:', { data, error });
      throw new Error('Failed to generate signed upload URL. Storage service returned null.');
    }

    // Return upload URL and path. Read URL will be generated after upload.
    return c.json({
      uploadUrl: data.signedUrl,
      path,
      token: data.token || null
    });
  } catch (e: any) {
    console.error('Storage sign endpoint error:', e);
    return c.json({ error: e.message || 'Failed to generate signed upload URL' }, 500);
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
    console.log('=== Device Registration ===');
    const body = await c.req.json().catch(() => ({}));
    const { ipAddress } = body;

    const supabase = getSupabase();

    // Generate unique PIN in BB8A-SDE7 format (alphanumeric)
    let pin = '';
    let attempts = 0;
    const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

    while (attempts < 10) {
      const part1 = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
      const part2 = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
      pin = `${part1}-${part2}`;

      // Check if PIN already exists in Supabase
      const { data: existing } = await supabase
        .from('devices')
        .select('id')
        .eq('pin', pin)
        .maybeSingle();

      if (!existing) break;
      attempts++;
    }

    if (!pin) {
      return c.json({ error: 'Failed to generate unique PIN' }, 500);
    }

    // Create device in Supabase
    const userAgent = c.req.header('user-agent') || 'Unknown';
    const deviceName = extractDeviceName(userAgent);

    const { data: newDevice, error } = await supabase
      .from('devices')
      .insert({
        pin,
        name: deviceName,
        activated: false,
        ip_address: ipAddress,
        screen_id: null,
      })
      .select()
      .single();

    if (error) throw error;

    console.log('Device created with PIN:', pin, 'ID:', newDevice.id);

    return c.json({
      deviceId: newDevice.id,
      pin,
      activated: false
    });
  } catch (e) {
    console.error('Registration error:', e);
    return c.json({ error: e.message }, 500);
  }
});

// CHECK ACTIVATION STATUS - Player polls this
app.get(`${BASE_PATH}/player/status`, async (c) => {
  try {
    const deviceId = c.req.query('deviceId');
    if (!deviceId) {
      return c.json({ error: 'deviceId required' }, 400);
    }

    const supabase = getSupabase();

    // Fetch device from Supabase
    const { data: device, error: deviceError } = await supabase
      .from('devices')
      .select('*')
      .eq('id', deviceId)
      .maybeSingle();

    if (deviceError) throw deviceError;

    if (!device) {
      // Device was deleted
      return c.json({
        activated: false,
        deleted: true
      });
    }

    // Update last seen
    await supabase
      .from('devices')
      .update({ last_seen: new Date().toISOString() })
      .eq('id', deviceId);

    // Return activation status and content if activated
    let content = [];
    if (device.activated && device.screen_id) {
      const screen = await kv.get(`screen:${device.screen_id}`);
      if (screen && screen.content) {
        // Expand contentId references to full content objects
        const expandedContent = [];
        for (const item of screen.content) {
          if (item.contentId) {
            // Lookup the actual content by ID
            const contentData = await kv.get(`content:${item.contentId}`);
            if (contentData) {
              // Merge content details with playlist item
              expandedContent.push({
                ...item,
                type: contentData.type,
                url: contentData.readUrl || contentData.url,
                name: contentData.name || contentData.fileName || 'Untitled'
              });
            } else {
              console.warn(`Content not found: ${item.contentId}`);
            }
          } else {
            // Item already has full data (legacy format)
            expandedContent.push(item);
          }
        }
        content = expandedContent;
      }
    }

    // Fetch user profile from Supabase
    let accountName = 'User';
    let accountAvatar = null;

    if (device.user_id) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('name, avatar_url')
        .eq('id', device.user_id)
        .maybeSingle();

      if (profile) {
        accountName = profile.name || 'User';
        accountAvatar = profile.avatar_url || null;
      }
    }

    return c.json({
      activated: device.activated,
      screenId: device.screen_id,
      content,
      accountName,
      accountAvatar,
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

    const supabase = getSupabase();

    // Find device by PIN
    const { data: device, error: findError } = await supabase
      .from('devices')
      .select('*')
      .eq('pin', pin)
      .maybeSingle();

    if (findError) throw findError;

    if (!device) {
      return c.json({ error: 'Invalid PIN' }, 404);
    }

    if (device.activated) {
      return c.json({ error: 'Device already activated' }, 400);
    }

    // Get authenticated user ID
    const authHeader = c.req.header('Authorization');
    let userId = null;

    if (authHeader) {
      try {
        const token = authHeader.replace('Bearer ', '');
        const { data: { user } } = await supabase.auth.getUser(token);
        if (user) {
          userId = user.id;
        }
      } catch (e) {
        console.log('Could not get user info:', e);
      }
    }

    // Update device
    const updates: any = {
      activated: true,
      activated_at: new Date().toISOString(),
      user_id: userId,
      pin: null, // Clear PIN after activation
    };

    if (name && name.trim()) {
      updates.name = name.trim();
    }

    const { error: updateError } = await supabase
      .from('devices')
      .update(updates)
      .eq('id', device.id);

    if (updateError) throw updateError;

    console.log('Device activated:', device.id, name || device.name);

    return c.json({ success: true, device: { ...device, ...updates } });
  } catch (error) {
    console.error('Activation error:', error);
    return c.json({ error: error.message }, 500);
  }
});

// DELETE DEVICE - Remove/deactivate device
app.delete(`${BASE_PATH}/devices/:id`, async (c) => {
  try {
    const id = c.req.param('id');

    const supabase = getSupabase();

    // Delete from Supabase
    const { error } = await supabase
      .from('devices')
      .delete()
      .eq('id', id);

    if (error) throw error;

    console.log('Device deleted:', id);
    return c.json({ success: true });
  } catch (error) {
    console.error('Delete error:', error);
    return c.json({ error: error.message }, 500);
  }
});

// List Devices (Admin) - with notification tracking

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

    const supabase = getSupabase();

    // Update device in Supabase
    const { data, error } = await supabase
      .from('devices')
      .update({
        screen_id: body.screenId,
        name: body.name,
        ...body
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return c.json({ error: "Device not found" }, 404);
      }
      throw error;
    }

    return c.json(data);
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

// --- Profile Routes ---

// Get User Profile
app.get(`${BASE_PATH}/profile`, async (c) => {
  try {
    const authHeader = c.req.header('Authorization');
    if (!authHeader) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const token = authHeader.replace('Bearer ', '');
    const supabase = getSupabase();
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const profileKey = `profile:${user.id}`;
    const profile = await kv.get(profileKey);

    if (!profile) {
      return c.json({
        name: user.email?.split('@')[0] || 'User',
        email: user.email || '',
        avatarUrl: null
      });
    }

    return c.json(profile);
  } catch (e) {
    console.error(e);
    return c.json({ error: e.message }, 500);
  }
});

// Update User Profile
app.put(`${BASE_PATH}/profile`, async (c) => {
  try {
    const authHeader = c.req.header('Authorization');
    if (!authHeader) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const token = authHeader.replace('Bearer ', '');
    const supabase = getSupabase();
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const body = await c.req.json();
    const profileKey = `profile:${user.id}`;

    const existingProfile = await kv.get(profileKey) || {};
    const updatedProfile = {
      ...existingProfile,
      name: body.name || existingProfile.name || user.email?.split('@')[0] || 'User',
      email: user.email || '',
      avatarUrl: body.avatarUrl !== undefined ? body.avatarUrl : existingProfile.avatarUrl,
      updatedAt: new Date().toISOString()
    };

    await kv.set(profileKey, updatedProfile);
    return c.json(updatedProfile);
  } catch (e) {
    console.error(e);
    return c.json({ error: e.message }, 500);
  }
});

// --- Notification Routes ---

// Helper function to create notification
async function createNotification(userId: string, type: string, message: string, deviceName: string) {
  const notificationId = crypto.randomUUID();
  const notification = {
    id: notificationId,
    userId,
    type,
    message,
    deviceName,
    timestamp: new Date().toISOString(),
    read: false
  };

  await kv.set(`notification:${notificationId}`, notification);

  // Add to user's notification list
  const userNotificationsKey = `user_notifications:${userId}`;
  const userNotifications = await kv.get(userNotificationsKey) || { notificationIds: [] };
  userNotifications.notificationIds = [...(userNotifications.notificationIds || []), notificationId];
  await kv.set(userNotificationsKey, userNotifications);

  return notification;
}

// Get Notifications for User
app.get(`${BASE_PATH}/notifications`, async (c) => {
  try {
    const authHeader = c.req.header('Authorization');
    if (!authHeader) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const token = authHeader.replace('Bearer ', '');
    const supabase = getSupabase();
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const userNotificationsKey = `user_notifications:${user.id}`;
    const userNotifications = await kv.get(userNotificationsKey) || { notificationIds: [] };

    const notificationIds = userNotifications.notificationIds || [];
    const notifications = [];

    for (const id of notificationIds.slice(-50)) { // Get last 50 notifications
      const notification = await kv.get(`notification:${id}`);
      if (notification) {
        notifications.push(notification);
      }
    }

    // Sort by timestamp, newest first
    notifications.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    const unreadCount = notifications.filter(n => !n.read).length;

    return c.json({
      notifications,
      unreadCount
    });
  } catch (e) {
    console.error(e);
    return c.json({ error: e.message }, 500);
  }
});

// Mark Notification as Read
app.post(`${BASE_PATH}/notifications/:id/read`, async (c) => {
  try {
    const authHeader = c.req.header('Authorization');
    if (!authHeader) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const token = authHeader.replace('Bearer ', '');
    const supabase = getSupabase();
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const notificationId = c.req.param('id');
    const notification = await kv.get(`notification:${notificationId}`);

    if (!notification || notification.userId !== user.id) {
      return c.json({ error: 'Notification not found' }, 404);
    }

    notification.read = true;
    await kv.set(`notification:${notificationId}`, notification);

    return c.json({ success: true });
  } catch (e) {
    console.error(e);
    return c.json({ error: e.message }, 500);
  }
});

// Track device status changes and create notifications
// This should be called when device status changes
async function trackDeviceStatus(device: any, previousStatus: string | null, userId: string) {
  const now = new Date().getTime();
  const lastSeen = new Date(device.lastSeen).getTime();
  const isOnline = (now - lastSeen) < 120000; // 2 minutes threshold

  if (previousStatus === null) {
    // New device, no notification needed
    return;
  }

  const wasOnline = previousStatus === 'online';

  if (wasOnline && !isOnline) {
    // Device went offline
    await createNotification(
      userId,
      'device_offline',
      `${device.name} went offline`,
      device.name
    );
  } else if (!wasOnline && isOnline) {
    // Device came online
    await createNotification(
      userId,
      'device_online',
      `${device.name} came online`,
      device.name
    );
  }
}

// Update device status check to track notifications
// Modify the devices list endpoint to track status changes
app.get(`${BASE_PATH}/devices`, async (c) => {
  try {
    const authHeader = c.req.header('Authorization');
    const token = authHeader?.replace('Bearer ', '');

    let userId = null;
    if (token) {
      try {
        const supabase = getSupabase();
        const { data: { user } } = await supabase.auth.getUser(token);
        userId = user?.id;
      } catch (e) {
        console.log('Could not get user:', e);
      }
    }

    const supabase = getSupabase();

    // Fetch devices from Supabase
    let query = supabase
      .from('devices')
      .select('*')
      .eq('activated', true); // Only show activated devices

    // Filter by user if authenticated
    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data: devices, error } = await query.order('activated_at', { ascending: false });

    if (error) throw error;

    // Transform to match expected format
    const formattedDevices = devices.map(device => ({
      id: device.id,
      name: device.name || 'Unnamed Device',
      status: device.activated ? 'online' : 'pending',
      lastSeen: device.last_seen || device.activated_at || device.created_at,
      screenId: device.screen_id,
      pin: device.pin,
      ipAddress: device.ip_address,
      userId: device.user_id,
      activated: device.activated
    }));

    return c.json(formattedDevices);
  } catch (e) {
    console.error('Error fetching devices:', e);
    return c.json({ error: e.message }, 500);
  }
});

// Add catch-all route for debugging 404s
app.all("*", async (c) => {
  console.log('404 - Path not found:', c.req.path);
  console.log('404 - Method:', c.req.method);
  console.log('404 - Full URL:', c.req.url);
  return c.json({
    error: 'Not Found',
    path: c.req.path,
    method: c.req.method,
    message: 'The requested endpoint does not exist. Check the path and method.'
  }, 404);
});

Deno.serve(app.fetch);
