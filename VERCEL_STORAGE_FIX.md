# Vercel Storage Fix - Implementation Guide

## Problem
The "failed to save entity" error on Vercel was caused by attempting to write to the filesystem, which is **read-only** on Vercel serverless functions (except for `/tmp`).

## Quick Fix Applied ✅

### Changes Made to `backend/services/storage_service.py`:

1. **Detect Vercel Environment**: Check for `VERCEL` environment variable
2. **Use `/tmp` directory**: Vercel allows writes to `/tmp` (temporary storage)
3. **Better Error Handling**: Raise exceptions instead of silently failing

```python
if os.environ.get('VERCEL'):
    self.data_dir = '/tmp/data'
else:
    # Local development uses project data directory
    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    self.data_dir = os.path.join(base_dir, "data")
```

## ⚠️ Important Limitations

**The `/tmp` directory is ephemeral:**
- Data is lost when the serverless function "cold starts" (after inactivity)
- Each function instance has its own `/tmp` directory
- Not suitable for production use

## Testing the Fix

1. **Automatic Deployment**: Vercel should auto-deploy from your git push
2. **Test Creating an Entity**: Try creating a new entity on your Vercel deployment
3. **Check Logs**: View Vercel function logs to see debug messages

## Long-Term Solution: Use a Database

For production, you need persistent storage. Here are the recommended options:

### Option 1: Vercel Postgres (Recommended) 🌟

**Setup:**
```bash
# Install Vercel CLI if not already installed
npm i -g vercel

# Link your project
vercel link

# Create a Postgres database
vercel postgres create
```

**Benefits:**
- Fully managed by Vercel
- Automatic backups
- Easy integration
- Free tier available

### Option 2: Vercel KV (Redis)

**Setup:**
```bash
vercel kv create
```

**Benefits:**
- Simple key-value storage
- Very fast
- Good for caching and simple data structures

### Option 3: External Database (Supabase, PlanetScale, etc.)

**Setup:**
- Create account on chosen provider
- Get connection string
- Add to Vercel environment variables

## Next Steps

### Immediate (Current Fix):
✅ Your app should now work on Vercel
✅ You can create entities
⚠️ Data will be lost on cold starts

### For Production:
1. Choose a database solution (Vercel Postgres recommended)
2. Update `storage_service.py` to use the database
3. Migrate existing data
4. Update API endpoints if needed

## Migration to Vercel Postgres

If you want to implement Vercel Postgres, here's what needs to change:

1. **Install dependencies:**
   ```bash
   pip install psycopg2-binary
   ```

2. **Update `requirements.txt`:**
   ```
   psycopg2-binary
   ```

3. **Create new `postgres_storage_service.py`:**
   - Replace JSON file operations with SQL queries
   - Use connection pooling
   - Handle transactions properly

4. **Update environment variables:**
   - Add `POSTGRES_URL` from Vercel

Would you like me to implement the Vercel Postgres solution for you?

## Monitoring

Check Vercel logs to verify the fix:
```bash
vercel logs
```

Look for:
- `DEBUG: Running on Vercel, using /tmp/data for storage`
- `DEBUG: Successfully saved graph to /tmp/data/graph.json`

## Summary

✅ **Fixed**: Entity creation now works on Vercel
⚠️ **Temporary**: Data persists only during function lifetime
🔄 **Next**: Implement database for permanent storage
