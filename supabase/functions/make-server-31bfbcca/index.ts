
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
    "http://localhost:5174",
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
  const url = Deno.env.get("SUPABASE_URL") ?? Deno.env.get("MY_SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("MY_SERVICE_ROLE_KEY");

  if (!url || !key) {
    throw new Error(`CRITICAL: Missing env vars. URL: ${!!url}, KEY: ${!!key}. Please set MY_SUPABASE_URL and MY_SERVICE_ROLE_KEY secrets.`);
  }

  return createClient(url, key);
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

    // Optional: Remove from programs that reference this content
    const programs = await kv.getByPrefix("program:");
    for (const program of programs) {
      if (program.content && program.content.some(c => c.id === id || c.contentId === id)) {
        const updatedContent = program.content.filter(c => c.id !== id && c.contentId !== id);
        await kv.set(`program:${program.id}`, { ...program, content: updatedContent });
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


// --- Program Routes ---

// List Programs
app.get(`${BASE_PATH}/programs`, async (c) => {
  try {
    const supabase = getSupabase();

    // Get auth token to filter by user
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

    // Fetch programs from Supabase
    const query = supabase
      .from('programs')
      .select('*')
      .order('created_at', { ascending: false });

    if (userId) {
      query.eq('user_id', userId);
    }

    const { data: programs, error } = await query;

    if (error) throw error;

    return c.json(programs || []);
  } catch (e) {
    console.error(e);
    return c.json({ error: e.message }, 500);
  }
});


// Get Program
app.get(`${BASE_PATH}/programs/:id`, async (c) => {
  try {
    const id = c.req.param("id");
    const supabase = getSupabase();

    const { data: program, error } = await supabase
      .from('programs')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    if (!program) return c.json({ error: "Not found" }, 404);

    // Fetch extra settings from KV
    try {
      const settings = await kv.get(`program_settings:${id}`);
      if (settings) {
        return c.json({ ...program, ...settings });
      }
    } catch (err) {
      console.warn('Failed to fetch program settings from KV:', err);
    }

    return c.json(program);
  } catch (e) {
    console.error(e);
    return c.json({ error: e.message }, 500);
  }
});

// Create Program
app.post(`${BASE_PATH}/programs`, async (c) => {
  try {
    const body = await c.req.json();
    const supabase = getSupabase();

    // Get user ID from auth
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

    const { data: newProgram, error } = await supabase
      .from('programs')
      .insert({
        ...body,
        user_id: userId,
        content: body.content || [],
      })
      .select()
      .single();

    if (error) throw error;

    return c.json(newProgram);
  } catch (e) {
    console.error(e);
    return c.json({ error: e.message }, 500);
  }
});

// Update Program
app.put(`${BASE_PATH}/programs/:id`, async (c) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();
    const supabase = getSupabase(); // Initialize client

    // 1. Get User Auth (Required for RLS)
    const authHeader = c.req.header('Authorization');
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      await supabase.auth.getUser(token); // Set auth context
    }

    // 2. Sanitize and Map Body
    // Only allow specific columns to prevent "column does not exist" errors
    const updates: any = {
      updated_at: new Date().toISOString(),
    };

    if (body.name !== undefined) updates.name = body.name;
    if (body.description !== undefined) updates.description = body.description;
    if (body.resolution !== undefined) updates.resolution = body.resolution;
    if (body.content !== undefined) updates.content = body.content;

    // Handle camelCase to snake_case mapping
    if (body.backgroundMusic !== undefined) updates.background_music = body.backgroundMusic;
    if (body.background_music !== undefined) updates.background_music = body.background_music;

    // Store extra settings in KV store (transition, backgroundMusicName)
    // accessible via program_settings:<id>
    try {
      const settings: any = {};
      if (body.transition !== undefined) settings.transition = body.transition;
      if (body.transitionDuration !== undefined) settings.transitionDuration = body.transitionDuration;
      if (body.backgroundMusicName !== undefined) settings.backgroundMusicName = body.backgroundMusicName;

      // Start: also allow snake_case input just in case
      if (body.transition_duration !== undefined) settings.transitionDuration = body.transition_duration;
      if (body.background_music_name !== undefined) settings.backgroundMusicName = body.background_music_name;

      if (Object.keys(settings).length > 0) {
        // Merge with existing settings if any
        const existing = await kv.get(`program_settings:${id}`) || {};
        await kv.set(`program_settings:${id}`, { ...existing, ...settings });
      }
    } catch (err) {
      console.error("Failed to save program settings to KV:", err);
    }

    // Note: backgroundMusicName is not currently in DB schema, ignoring it to prevent 500 error
    // If needed, we should add a column via migration

    const { data: updated, error } = await supabase
      .from('programs')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Program update error:', error);
      if (error.code === 'PGRST116') {
        return c.json({ error: "Not found or permission denied" }, 404);
      }
      throw error;
    }

    return c.json(updated);
  } catch (e) {
    console.error(e);
    return c.json({ error: e.message }, 500);
  }
});

// Delete Program
app.delete(`${BASE_PATH}/programs/:id`, async (c) => {
  try {
    const id = c.req.param("id");
    const supabase = getSupabase();

    // Get User Auth
    const authHeader = c.req.header('Authorization');
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      await supabase.auth.getUser(token);
    }

    // Delete from Supabase
    const { error } = await supabase
      .from('programs')
      .delete()
      .eq('id', id);

    if (error) throw error;

    // Unassign devices (use service role or ensure user has access)
    // For safety, we might fail here if user doesn't own devices. 
    // But failing to unassign is better than failing to delete program.
    try {
      await supabase
        .from('devices')
        .update({ program_id: null })
        .eq('program_id', id);
    } catch (err) {
      console.warn('Failed to unassign devices during program delete:', err);
    }

    return c.json({ success: true });
  } catch (e) {
    console.error(e);
    return c.json({ error: e.message }, 500);
  }
});



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
        program_id: null,
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
    let backgroundMusic = null;
    let programSettings = {};
    let program = null;

    const programId = device.program_id || device.screen_id; // Support both

    if (device.activated && programId) {
      // Fetch program from Supabase instead of KV store
      const { data: fetchedProgram, error: programError } = await supabase
        .from('programs')
        .select('*')
        .eq('id', programId)
        .maybeSingle();

      program = fetchedProgram;

      if (programError) {
        console.error('Error fetching program:', programError);
      }

      // Fetch extra settings from KV
      try {
        const settings = await kv.get(`program_settings:${programId}`);
        if (settings) {
          programSettings = settings;
        }
      } catch (err) {
        console.warn('Failed to fetch program settings from KV in status:', err);
      }

      if (program && program.content) {
        console.log(`[Status] Processing ${program.content.length} items for program ${programId}`);
        // Expand contentId references to full content objects
        const expandedContent = [];
        for (const item of program.content) {
          if (item.contentId) {
            // Lookup the actual content by ID from KV store
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
              console.warn(`[Status] Content not found in KV: content:${item.contentId}`);
            }
          } else {
            // Item already has full data (legacy format)
            expandedContent.push(item);
          }
        }
        console.log(`[Status] Expanded content count: ${expandedContent.length}`);
        content = expandedContent;
      }

      // Get background music from program
      if (program && program.background_music) {
        backgroundMusic = program.background_music;
      } else if (program && program.backgroundMusic) {
        backgroundMusic = program.backgroundMusic;
      }
    }

    // Fetch user profile from Supabase
    let accountName = 'User';
    let accountAvatar = null;

    // Resolve owner ID (check device first, then fall back to program owner)
    let ownerId = device.user_id;
    if (!ownerId && program && program.user_id) {
      ownerId = program.user_id;
    }

    if (ownerId) {
      // Try to get profile from KV first (primary source of truth for admin panel)
      try {
        const profileKey = `profile:${ownerId}`;
        const profile = await kv.get(profileKey);

        if (profile) {
          accountName = profile.name || accountName;
          accountAvatar = profile.avatarUrl || accountAvatar;
        } else {
          // Fallback to Supabase profiles table if not in KV
          const { data: dbProfile } = await supabase
            .from('profiles')
            .select('name, avatar_url')
            .eq('id', ownerId)
            .maybeSingle();

          if (dbProfile) {
            accountName = dbProfile.name || accountName;
            accountAvatar = dbProfile.avatar_url || accountAvatar;
          }
        }
      } catch (err) {
        console.warn('Failed to fetch profile from KV:', err);
      }
    }

    return c.json({
      activated: device.activated,
      screenId: device.program_id || device.screen_id, // Check program_id first
      content,
      backgroundMusic,
      accountName,
      accountAvatar,
      deviceName: device.name || 'Display Device',
      ownerId: device.user_id,
      ...programSettings // Spread global settings
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
    const supabase = getSupabase();

    // Find device by PIN
    const { data: device } = await supabase
      .from('devices')
      .select('*')
      .eq('pin', pin)
      .eq('activated', false) // Only claim inactive devices
      .maybeSingle();

    if (!device) {
      return c.json({ error: "Invalid PIN or device already activated" }, 400);
    }

    // Update device
    const { data: updated, error } = await supabase
      .from('devices')
      .update({
        name,
        status: 'online',
        activated: true,
        last_seen: new Date().toISOString()
      })
      .eq('id', device.id)
      .select()
      .single();

    if (error) throw error;

    return c.json(updated);
  } catch (e) {
    console.error('Claim error:', e);
    return c.json({ error: e.message }, 500);
  }
});

// MIGRATE DATA - Recover old KV screens to Supabase Programs
app.post(`${BASE_PATH}/migrate-data`, async (c) => {
  try {
    const supabase = getSupabase();
    console.log('Starting migration...');

    // 1. Fetch old screens from KV
    const screens = await kv.getByPrefix("screen:");
    console.log(`Found ${screens.length} screens in KV store`);

    let migratedCount = 0;

    for (const screen of screens) {
      // Check if already exists in Supabase
      const { data: existing } = await supabase
        .from('programs')
        .select('id')
        .eq('id', screen.id)
        .maybeSingle();

      if (!existing) {
        // Create program in Supabase
        const { error } = await supabase
          .from('programs')
          .insert({
            id: screen.id,
            name: screen.name || 'Untitled Program',
            description: screen.description,
            resolution: screen.resolution || '1920x1080',
            content: screen.content || [],
            background_music: screen.backgroundMusic || screen.background_music,
            created_at: new Date().toISOString()
          });

        if (error) {
          console.error(`Failed to migrate screen ${screen.id}:`, error);
        } else {
          migratedCount++;
        }
      }
    }

    return c.json({
      success: true,
      message: `Migrated ${migratedCount} programs from KV store`,
      totalFound: screens.length
    });
  } catch (e) {
    console.error('Migration error:', e);
    return c.json({ error: e.message }, 500);
  }
});

// Update Device (Assign screen, etc)
app.put(`${BASE_PATH}/devices/:id`, async (c) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();

    const supabase = getSupabase();

    // Get User Auth
    const authHeader = c.req.header('Authorization');
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      await supabase.auth.getUser(token);
    }

    // Prepare update data - handle both camelCase and snake_case
    const updateData: any = {};

    // Handle program assignment (map from screenId/programId)
    if (body.programId !== undefined) {
      updateData.program_id = body.programId;
    } else if (body.program_id !== undefined) {
      updateData.program_id = body.program_id;
    } else if (body.screenId !== undefined) {
      updateData.program_id = body.screenId; // Legacy support
    } else if (body.screen_id !== undefined) {
      updateData.program_id = body.screen_id; // Legacy support
    }

    // Handle name
    if (body.name !== undefined) {
      updateData.name = body.name;
    }

    // Update device in Supabase
    const { data, error } = await supabase
      .from('devices')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Device update error:', error);
      if (error.code === 'PGRST116') {
        return c.json({ error: "Device not found or permission denied" }, 404);
      }
      throw error;
    }

    return c.json(data);
  } catch (e) {
    console.error('Device update exception:', e);
    return c.json({ error: e.message }, 500);
  }
});

// Delete Device
app.delete(`${BASE_PATH}/devices/:id`, async (c) => {
  try {
    const id = c.req.param("id");
    const supabase = getSupabase();

    // Get User Auth
    const authHeader = c.req.header('Authorization');
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      await supabase.auth.getUser(token);
    }

    const { error } = await supabase
      .from('devices')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return c.json({ success: true });
  } catch (e) {
    console.error(e);
    return c.json({ error: e.message }, 500);
  }
});

// Stats
app.get(`${BASE_PATH}/dashboard/stats`, async (c) => {
  try {
    const supabase = getSupabase();
    const { count: programsCount } = await supabase.from('programs').select('*', { count: 'exact', head: true });
    const { count: devicesCount } = await supabase.from('devices').select('*', { count: 'exact', head: true });

    // Online devices (based on status or last_seen - using status for now as it's updated on ping)
    const { count: onlineDevicesCount } = await supabase
      .from('devices')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'online');

    const content = await kv.getByPrefix("content:"); // Content still in KV for now

    return c.json({
      programsCount: programsCount || 0,
      devicesCount: devicesCount || 0,
      onlineDevicesCount: onlineDevicesCount || 0,
      contentCount: content.length,
    });
  } catch (e) {
    console.error(e);
    // Return zeros on error to prevent dashboard crash
    return c.json({
      programsCount: 0,
      devicesCount: 0,
      onlineDevicesCount: 0,
      contentCount: 0
    });
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
    // if (userId) {
    //   query = query.eq('user_id', userId);
    // }

    const { data: devices, error } = await query.order('activated_at', { ascending: false });

    if (error) throw error;

    // Transform to match expected format
    const formattedDevices = devices.map(device => ({
      id: device.id,
      name: device.name || 'Unnamed Device',
      status: device.activated ? 'online' : 'pending',
      lastSeen: device.last_seen || device.activated_at || device.created_at,
      screenId: device.program_id || device.screen_id, // Check program_id first
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
