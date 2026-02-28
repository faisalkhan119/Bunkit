# Bunkit App - Full Audit Report
## Date: December 13, 2025

---

## 🔴 CRITICAL ISSUES

### 1. **Silent Token Refresh Has 500ms Delay**
**File:** `index.html` line 5062-5080

**Problem:** `silentTokenRefresh()` has `setTimeout(() => {...}, 500)` delay, meaning token isn't ready immediately when `syncWithDrive()` is called.

**Impact:** First sync after app open often fails because token isn't ready.

**Fix Needed:** Remove the 500ms delay or make syncWithDrive wait for token.

---

### 2. **Token Not Stored in googleUser During Silent Refresh**
**File:** `index.html` line 5062

**Problem:** When `silentTokenRefresh()` calls `tokenClient.requestAccessToken()`, the token goes to `handleTokenResponse()` which calls `fetchUserInfo()`, but `fetchUserInfo()` doesn't update the existing `googleUser.accessToken` - it creates a new object.

**Impact:** After silent refresh, token is received but `googleUser.accessToken` might still be undefined when sync is called.

**Fix Needed:** Ensure `handleTokenResponse` properly updates existing `googleUser` object.

---

### 3. **No Return Value After 403 Handling**
**File:** `index.html` line 5803-5810

**Problem:** In `findBackupFileId()`, after 403 error, it requests consent and returns `null`, but `syncWithDrive()` doesn't know that consent was requested. It just sees `null` and thinks no backup exists.

**Impact:** After consent popup, user has to click sync AGAIN.

**Fix Needed:** Add a flag or return a special value to indicate "consent requested, please retry".

---

### 4. **Empty Token Check Logic Flaw**
**File:** `index.html` line 5871-5880

**Problem:** `syncWithDrive()` checks `if (googleUser && !googleUser.accessToken)` then requests token with `prompt: ''`. But if token is empty string or undefined, the behavior is inconsistent.

**Impact:** Sometimes sync proceeds with no token and fails at API call.

**Fix Needed:** Use `!googleUser?.accessToken` consistently.

---

## 🟡 MODERATE ISSUES

### 5. **Auto-Sync Not Triggered After Token Refresh**
**File:** `index.html` line 5098-5108

**Problem:** `checkAndAutoSync()` is called from `handleTokenResponse()`, but it checks `googleUser?.accessToken` which might not be set yet when the function runs.

**Fix Needed:** Wait for `fetchUserInfo()` to complete before calling `checkAndAutoSync()`.

---

### 6. **updateDriveFile Missing 403 Handling**
**File:** `index.html` line 5854-5867

**Problem:** `updateDriveFile()` doesn't handle 403/401 errors like `createDriveFile()` does.

**Impact:** If token expires during update, user gets no helpful error message.

**Fix Needed:** Add same 403 handling as createDriveFile.

---

### 7. **downloadBackupFromDrive Missing 403 Handling**
**File:** `index.html` line 5763-5792

**Problem:** `downloadBackupFromDrive()` doesn't handle 403 errors. Only `findBackupFileId()` does.

**Impact:** If first request succeeds but download fails, user gets generic error.

**Fix Needed:** Add 403 handling to downloadBackupFromDrive.

---

## 🟢 MINOR ISSUES

### 8. **Debug Logs Should Be Removed**
Multiple console.log statements for debugging should be cleaned up for production.

---

### 9. **lastAppInteraction Not Always Set**
**File:** `index.html` line 6001

**Problem:** Sync logic relies on `lastAppInteraction` but this might not be set if user just logs and doesn't interact.

---

### 10. **No Sync Success Confirmation**
When sync succeeds, there's toast message but no clear visual indicator that data is synced.

---

## 📋 RECOMMENDED FIXES (Priority Order)

1. **HIGH:** Remove 500ms delay from silentTokenRefresh
2. **HIGH:** Add flag to track "consent pending" state
3. **HIGH:** Add 403 handling to updateDriveFile and downloadBackupFromDrive
4. **MEDIUM:** Make sync wait for token if refresh is in progress
5. **MEDIUM:** Add retry button when sync fails
6. **LOW:** Clean up debug logs
7. **LOW:** Add sync status indicator in UI

---

## 🔧 QUICK FIXES TO APPLY NOW

See implementation below.
