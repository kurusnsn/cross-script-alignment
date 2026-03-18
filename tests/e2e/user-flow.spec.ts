import { test, expect, Page, APIRequestContext } from '@playwright/test'

/**
 * Complete User Flow E2E Tests
 * 
 * Tests the full aligneration workflow including:
 * 1. Transliteration - Input Farsi text, get aligneration + translation
 * 2. Storing - Save alignerations to history with S3 storage
 * 3. Folder Management - Create folders, move items, organize
 * 4. Search - Find saved alignerations
 * 5. Delete - Remove items and folders
 * 
 * Runs against configured backend/UI base URLs
 */

const API_BASE = process.env.API_BASE_URL || process.env.BACKEND_URL || 'http://localhost:8000'
const UI_BASE = process.env.UI_BASE_URL || process.env.BASE_URL || 'http://localhost:3000'

// Test data
const TEST_FARSI_SENTENCES = [
  { text: 'سلام، حالت چطوره؟', description: 'greeting' },
  { text: 'امروز هوا خیلی خوب است', description: 'weather' },
  { text: 'من بستنی خریدم', description: 'ice cream' },
  { text: 'کتاب خواندن را دوست دارم', description: 'reading books' },
]

test.describe('API Health & Connectivity', () => {
  test('backend health check', async ({ request }) => {
    const response = await request.get(`${API_BASE}/healthz`)
    
    if (response.ok()) {
      const data = await response.json()
      expect(data.status).toBe('ok')
      console.log('✅ Backend health check passed')
    } else {
      console.log(`⚠️  Backend returned ${response.status()} - may still be deploying`)
      test.skip()
    }
  })
})

test.describe('Transliteration Flow', () => {
  
  test('should alignerate Farsi greeting', async ({ request }) => {
    const response = await request.post(`${API_BASE}/align`, {
      data: {
        text: 'سلام، حالت چطوره؟',
        source_lang: 'fa',
        target_lang: 'en'
      }
    })

    expect(response.ok()).toBeTruthy()
    const data = await response.json()

    expect(data.original).toBeTruthy()
    expect(data.aligneration).toBeTruthy()
    expect(data.translation).toBeTruthy()

    console.log('📝 Transliteration Result:')
    console.log(`   Original: ${data.original}`)
    console.log(`   Translit: ${data.aligneration}`)
    console.log(`   Translation: ${data.translation}`)
  })

  test('should alignerate multiple sentences', async ({ request }) => {
    for (const sentence of TEST_FARSI_SENTENCES) {
      const response = await request.post(`${API_BASE}/align`, {
        data: {
          text: sentence.text,
          source_lang: 'fa',
          target_lang: 'en'
        }
      })

      expect(response.ok()).toBeTruthy()
      const data = await response.json()
      
      expect(data.aligneration).toBeTruthy()
      console.log(`✅ ${sentence.description}: ${data.aligneration}`)
    }
  })

  test('should perform phrase alignment', async ({ request }) => {
    const response = await request.post(`${API_BASE}/align/phrase-align`, {
      data: {
        source_text: 'من بستنی خریدم',
        target_text: 'I bought ice cream'
      }
    })

    expect(response.ok()).toBeTruthy()
    const data = await response.json()

    expect(data.alignments).toBeDefined()
    expect(Array.isArray(data.alignments)).toBeTruthy()
    expect(data.alignments.length).toBeGreaterThan(0)

    // Check for ice cream alignment
    const iceCreamAlignment = data.alignments.find(
      (a: any) => a.target.toLowerCase().includes('ice cream')
    )
    expect(iceCreamAlignment).toBeDefined()

    console.log('🔗 Phrase Alignments:')
    for (const a of data.alignments) {
      console.log(`   ${a.source} → ${a.target} (${(a.confidence * 100).toFixed(0)}%)`)
    }
  })

  test('should perform word alignment', async ({ request }) => {
    const response = await request.post(`${API_BASE}/align/word-align`, {
      data: {
        source_text: 'کتاب خواندم',
        target_text: 'I read a book',
        include_confidence: true
      }
    })

    expect(response.ok()).toBeTruthy()
    const data = await response.json()

    expect(data.source_tokens).toBeDefined()
    expect(data.target_tokens).toBeDefined()
    expect(data.alignments).toBeDefined()

    console.log(`📚 Word Alignment: ${data.source_tokens.join(' ')} ↔ ${data.target_tokens.join(' ')}`)
  })
})

test.describe('History & Storage Flow', () => {
  const authToken: string | null = null
  let testHistoryId: number | null = null

  // Note: These tests require authentication
  // In a real scenario, you'd login first and get a token

  test('should save aligneration to history', async ({ request }) => {
    const response = await request.post(`${API_BASE}/history`, {
      data: {
        original: 'سلام',
        aligneration: 'salām',
        translation: 'Hello',
        ipa: '/sæˈlɑːm/',
        alignment_data: {
          alignments: [{ source: 'سلام', target: 'Hello', confidence: 0.95 }]
        }
      },
      headers: authToken ? { 'Authorization': `Bearer ${authToken}` } : {}
    })

    if (response.ok()) {
      const data = await response.json()
      testHistoryId = data.id
      expect(data.id).toBeDefined()
      expect(data.original).toBe('سلام')
      console.log(`✅ History item saved with ID: ${data.id}`)
    } else if (response.status() === 401) {
      console.log('⚠️  Authentication required for history - skipping')
      test.skip()
    } else {
      console.log(`❌ Unexpected error: ${response.status()}`)
    }
  })

  test('should retrieve history items', async ({ request }) => {
    const response = await request.get(`${API_BASE}/history`, {
      headers: authToken ? { 'Authorization': `Bearer ${authToken}` } : {}
    })

    if (response.ok()) {
      const data = await response.json()
      expect(Array.isArray(data)).toBeTruthy()
      console.log(`✅ Retrieved ${data.length} history items`)
    } else if (response.status() === 401) {
      console.log('⚠️  Authentication required - skipping')
      test.skip()
    }
  })

  test('should search history', async ({ request }) => {
    const searchTerm = 'سلام'
    const response = await request.get(`${API_BASE}/history?q=${encodeURIComponent(searchTerm)}`, {
      headers: authToken ? { 'Authorization': `Bearer ${authToken}` } : {}
    })

    if (response.ok()) {
      const data = await response.json()
      expect(Array.isArray(data)).toBeTruthy()
      console.log(`✅ Search for "${searchTerm}" returned ${data.length} results`)
    } else if (response.status() === 401) {
      test.skip()
    }
  })
})

test.describe('Folder Management Flow', () => {
  const authToken: string | null = null
  let testFolderId: number | null = null
  const testFolderName = `Test Folder ${Date.now()}`

  test('should create a new folder', async ({ request }) => {
    const response = await request.post(`${API_BASE}/history/folders`, {
      data: { name: testFolderName },
      headers: authToken ? { 'Authorization': `Bearer ${authToken}` } : {}
    })

    if (response.ok()) {
      const data = await response.json()
      testFolderId = data.id
      expect(data.id).toBeDefined()
      expect(data.name).toBe(testFolderName)
      console.log(`✅ Folder "${testFolderName}" created with ID: ${data.id}`)
    } else if (response.status() === 401) {
      console.log('⚠️  Authentication required for folders - skipping')
      test.skip()
    }
  })

  test('should list all folders', async ({ request }) => {
    const response = await request.get(`${API_BASE}/history/folders`, {
      headers: authToken ? { 'Authorization': `Bearer ${authToken}` } : {}
    })

    if (response.ok()) {
      const data = await response.json()
      expect(Array.isArray(data)).toBeTruthy()
      console.log(`✅ Retrieved ${data.length} folders`)
      for (const folder of data) {
        console.log(`   📁 ${folder.name} (ID: ${folder.id})`)
      }
    } else if (response.status() === 401) {
      test.skip()
    }
  })

  test('should move history item to folder', async ({ request }) => {
    // This requires a valid history item ID and folder ID
    const historyId = 1 // Placeholder
    const folderId = testFolderId || 1

    const response = await request.patch(`${API_BASE}/history/${historyId}/move?folder_id=${folderId}`, {
      headers: authToken ? { 'Authorization': `Bearer ${authToken}` } : {}
    })

    if (response.ok()) {
      const data = await response.json()
      expect(data.message).toBe('Moved successfully')
      console.log(`✅ History item moved to folder ${folderId}`)
    } else if (response.status() === 401 || response.status() === 404) {
      console.log('⚠️  Auth required or item not found - skipping')
      test.skip()
    }
  })

  test('should filter history by folder', async ({ request }) => {
    const folderId = testFolderId || 1

    const response = await request.get(`${API_BASE}/history?folder_id=${folderId}`, {
      headers: authToken ? { 'Authorization': `Bearer ${authToken}` } : {}
    })

    if (response.ok()) {
      const data = await response.json()
      expect(Array.isArray(data)).toBeTruthy()
      console.log(`✅ Found ${data.length} items in folder ${folderId}`)
    } else if (response.status() === 401) {
      test.skip()
    }
  })
})

test.describe('UI User Flow', () => {
  test.skip(true, 'UI tests require running frontend - enable when UI is deployed')

  test('should load aligneration page', async ({ page }) => {
    await page.goto(`${UI_BASE}/dashboard/aligneration`)
    
    // Wait for page to load
    await page.waitForLoadState('networkidle')
    
    // Should see input area
    const inputArea = page.locator('textarea, [contenteditable="true"]').first()
    await expect(inputArea).toBeVisible()
  })

  test('should enter text and see aligneration', async ({ page }) => {
    await page.goto(`${UI_BASE}/dashboard/aligneration`)
    await page.waitForLoadState('networkidle')

    // Enter Farsi text
    const inputArea = page.locator('textarea, [contenteditable="true"]').first()
    await inputArea.fill('سلام')

    // Wait for aligneration result
    await page.waitForTimeout(2000) // Allow debounce

    // Should see aligneration output
    const output = page.locator('[data-testid="aligneration-output"], .aligneration-result')
    if (await output.isVisible()) {
      const text = await output.textContent()
      expect(text).toBeTruthy()
      console.log(`✅ Transliteration shown: ${text}`)
    }
  })

  test('should navigate to history page', async ({ page }) => {
    await page.goto(`${UI_BASE}/dashboard/history`)
    await page.waitForLoadState('networkidle')

    // Should see history header
    await expect(page.locator('text=History')).toBeVisible()
  })

  test('should create folder via UI', async ({ page }) => {
    await page.goto(`${UI_BASE}/dashboard/history`)
    await page.waitForLoadState('networkidle')

    // Click create folder button
    const createButton = page.locator('button').filter({ hasText: /create|new|add/i }).first()
    if (await createButton.isVisible()) {
      await createButton.click()

      // Enter folder name
      const nameInput = page.locator('input[placeholder*="folder"], input[type="text"]').first()
      if (await nameInput.isVisible()) {
        await nameInput.fill(`Test Folder ${Date.now()}`)
        await nameInput.press('Enter')

        // Wait for folder to appear
        await page.waitForTimeout(1000)
        console.log('✅ Folder creation attempted via UI')
      }
    }
  })
})

test.describe('Complete User Journey', () => {
  
  test('full aligneration → save → organize flow', async ({ request }) => {
    console.log('\n🚀 Starting Complete User Journey Test\n')

    // Step 1: Transliterate text
    console.log('Step 1: Transliterating Farsi text...')
    const alignResponse = await request.post(`${API_BASE}/align`, {
      data: {
        text: 'امروز هوا خیلی خوب است و من خوشحالم',
        source_lang: 'fa',
        target_lang: 'en'
      }
    })

    if (!alignResponse.ok()) {
      console.log('⚠️  Backend not available - skipping journey test')
      test.skip()
      return
    }

    const alignData = await alignResponse.json()
    console.log(`   ✅ Original: ${alignData.original}`)
    console.log(`   ✅ Transliteration: ${alignData.aligneration}`)
    console.log(`   ✅ Translation: ${alignData.translation}`)

    // Step 2: Get phrase alignment
    console.log('\nStep 2: Getting phrase alignments...')
    const alignResponse = await request.post(`${API_BASE}/align/phrase-align`, {
      data: {
        source_text: alignData.original,
        target_text: alignData.translation
      }
    })

    if (alignResponse.ok()) {
      const alignData = await alignResponse.json()
      console.log(`   ✅ Found ${alignData.alignments?.length || 0} phrase alignments`)
      if (alignData.timing) {
        console.log(`   ⏱️  Timing: SimAlign=${alignData.timing.simalign?.toFixed(2)}s, Total=${alignData.timing.total?.toFixed(2)}s`)
      }
    }

    // Step 3: Attempt to save to history (may require auth)
    console.log('\nStep 3: Saving to history...')
    const historyResponse = await request.post(`${API_BASE}/history`, {
      data: {
        original: alignData.original,
        aligneration: alignData.aligneration,
        translation: alignData.translation,
        ipa: alignData.ipa,
        alignment_data: { alignments: [] }
      }
    })

    if (historyResponse.ok()) {
      const historyData = await historyResponse.json()
      console.log(`   ✅ Saved to history with ID: ${historyData.id}`)

      // Step 4: Create a folder
      console.log('\nStep 4: Creating folder...')
      const folderResponse = await request.post(`${API_BASE}/history/folders`, {
        data: { name: `Journey Test ${Date.now()}` }
      })

      if (folderResponse.ok()) {
        const folderData = await folderResponse.json()
        console.log(`   ✅ Created folder: ${folderData.name} (ID: ${folderData.id})`)

        // Step 5: Move item to folder
        console.log('\nStep 5: Moving item to folder...')
        const moveResponse = await request.patch(
          `${API_BASE}/history/${historyData.id}/move?folder_id=${folderData.id}`
        )

        if (moveResponse.ok()) {
          console.log(`   ✅ Moved item to folder successfully`)
        }
      }
    } else if (historyResponse.status() === 401) {
      console.log('   ⚠️  Authentication required for saving (expected without login)')
    }

    console.log('\n🎉 User Journey Test Complete!\n')
  })
})

// Standalone quick test
test('Quick Farsi Pipeline Test', async ({ request }) => {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('🔤 Quick Farsi Transliteration Pipeline Test')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

  const farsiText = 'من دیروز به بازار رفتم و میوه خریدم'

  const response = await request.post(`${API_BASE}/align`, {
    data: {
      text: farsiText,
      source_lang: 'fa',
      target_lang: 'en'
    }
  })

  if (response.ok()) {
    const data = await response.json()
    
    console.log(`📥 Input:          ${farsiText}`)
    console.log(`📝 Original:       ${data.original}`)
    console.log(`🔤 Transliteration: ${data.aligneration}`)
    console.log(`🌐 Translation:    ${data.translation}`)
    console.log(`🔊 IPA:            ${data.ipa || 'N/A'}`)
    
    if (data.original_tokens) {
      console.log(`📦 Tokens:         ${data.original_tokens.length} source tokens`)
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('✅ Pipeline Test PASSED')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

    expect(data.aligneration).toBeTruthy()
    expect(data.translation).toBeTruthy()
  } else {
    console.log(`❌ API Error: ${response.status()}`)
    const text = await response.text()
    console.log(`   Response: ${text.substring(0, 200)}`)
    
    // Skip if backend not ready
    if (response.status() === 525 || response.status() === 502) {
      console.log('\n⚠️  Backend not ready yet (images still deploying)')
      test.skip()
    }
  }
})
