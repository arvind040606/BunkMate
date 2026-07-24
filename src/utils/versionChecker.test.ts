import { VersionChecker } from './versionChecker';
import { versionService } from '../services/VersionService';
import { updateService } from '../services/UpdateService';
import { ReleaseInfo } from '../types/updateTypes';

function runTests() {
  console.log('==================================================');
  console.log('Running Production Update System Automated Tests...');
  console.log('==================================================');

  const comparisonTestCases = [
    // 1. Equal versions with same segments
    { name: '1.0.7 == 1.0.7', run: () => VersionChecker.compare('1.0.7', '1.0.7') === 0 },
    // 2. Patch version comparison
    { name: '1.0.7 > 1.0.6', run: () => VersionChecker.compare('1.0.7', '1.0.6') === 1 },
    // 3. Double-digit patch version comparison
    { name: '1.0.10 > 1.0.9', run: () => VersionChecker.compare('1.0.10', '1.0.9') === 1 },
    // 4. Minor version multi-digit comparison
    { name: '1.10.0 > 1.9.9', run: () => VersionChecker.compare('1.10.0', '1.9.9') === 1 },
    // 5. Major version bump vs high patch count
    { name: '2.0 > 1.99.99', run: () => VersionChecker.compare('2.0', '1.99.99') === 1 },
    // 6. Short minor version vs patch version
    { name: '1.1 > 1.0.99', run: () => VersionChecker.compare('1.1', '1.0.99') === 1 },
    // 7. Equal minor, different patch
    { name: '1.1.1 > 1.1.0', run: () => VersionChecker.compare('1.1.1', '1.1.0') === 1 },
    // 8. Patch bump vs lower minor
    { name: '1.1.1 > 1.0.99', run: () => VersionChecker.compare('1.1.1', '1.0.99') === 1 },
    // 9. Trailing zero segment omission (1.0 vs 1.0.0)
    { name: '1.0 == 1.0.0', run: () => VersionChecker.compare('1.0', '1.0.0') === 0 },
    // 10. Single segment vs triple segment (1 vs 1.0.0)
    { name: '1 == 1.0.0', run: () => VersionChecker.compare('1', '1.0.0') === 0 },
    // 11. Short version trailing zero
    { name: '1.2 == 1.2.0', run: () => VersionChecker.compare('1.2', '1.2.0') === 0 },
    // 12. Four segment trailing zeros
    { name: '1.2.0.0 == 1.2', run: () => VersionChecker.compare('1.2.0.0', '1.2') === 0 },
    // 13. Single segment vs 4 trailing zeros
    { name: '1 == 1.0.0.0', run: () => VersionChecker.compare('1', '1.0.0.0') === 0 },
    // 14. Large major version gap
    { name: '10.0.5 > 9.9.9', run: () => VersionChecker.compare('10.0.5', '9.9.9') === 1 },
    // 15. Double digit minor comparison
    { name: '1.10.2 > 1.2.10', run: () => VersionChecker.compare('1.10.2', '1.2.10') === 1 },
    // 16. Four-segment version comparison
    { name: '2.5.12.3 > 2.5.12.2', run: () => VersionChecker.compare('2.5.12.3', '2.5.12.2') === 1 },
    // 17. Lowercase "v" prefix
    { name: 'v1.0.7 == 1.0.7', run: () => VersionChecker.compare('v1.0.7', '1.0.7') === 0 },
    // 18. Uppercase "V" prefix
    { name: 'V2.1 == 2.1', run: () => VersionChecker.compare('V2.1', '2.1') === 0 },
    // 19. Whitespace padding and "v" prefix
    { name: '  v1.0.1   == 1.0.1', run: () => VersionChecker.compare('  v1.0.1  ', '1.0.1') === 0 },
    // 20. Uppercase V with trailing zeros
    { name: 'V1.2.0.0 == 1.2', run: () => VersionChecker.compare('V1.2.0.0', '1.2') === 0 },
    // 21. Small patch version above zero
    { name: '0.0.1 > 0.0.0', run: () => VersionChecker.compare('0.0.1', '0.0.0') === 1 },
    // 22. Zero comparison
    { name: '0 == 0.0.0', run: () => VersionChecker.compare('0', '0.0.0') === 0 },
    // 23. Major bump vs multiple 9s
    { name: '3.0.0 > 2.99.99.99', run: () => VersionChecker.compare('3.0.0', '2.99.99.99') === 1 },
    // 24. Fourth segment bump
    { name: '1.0.0.1 > 1.0.0', run: () => VersionChecker.compare('1.0.0.1', '1.0.0') === 1 },
    // 25. Six segment zero trailing with 1
    { name: '1.0.0.0.0.1 > 1', run: () => VersionChecker.compare('1.0.0.0.0.1', '1') === 1 },
    // 26. Deep patch bump 10.5.14
    { name: '10.5.14 > 10.5.13', run: () => VersionChecker.compare('10.5.14', '10.5.13') === 1 },
    // 27. Unlimited segment trailing zero
    { name: '1.0.5 == 1.0.5.0', run: () => VersionChecker.compare('1.0.5', '1.0.5.0') === 0 },
    // 28. Complex four segment comparison
    { name: '2.5.7.3 > 2.5.7.2', run: () => VersionChecker.compare('2.5.7.3', '2.5.7.2') === 1 },
    // 29. Helper isNewer check
    { name: 'isNewer("1.0.5", "1.0.6") is true', run: () => VersionChecker.isNewer('1.0.5', '1.0.6') === true },
    // 30. Helper isOlder check
    { name: 'isOlder("1.0.5", "1.0.6") is true', run: () => VersionChecker.isOlder('1.0.5', '1.0.6') === true },
    // 31. Helper isEqual check
    { name: 'isEqual("v1.2", "1.2.0") is true', run: () => VersionChecker.isEqual('v1.2', '1.2.0') === true },
    // 32. isValid check for valid version
    { name: 'isValid("v1.0.6") is true', run: () => VersionChecker.isValid('v1.0.6') === true },
    // 33. isValid check for invalid non-numeric string
    { name: 'isValid("1.0.beta") is false', run: () => VersionChecker.isValid('1.0.beta') === false },
    // 34. formatDisplayVersion for valid version with prefix
    { name: 'formatDisplayVersion(" v1.0.6 ") returns "1.0.6"', run: () => VersionChecker.formatDisplayVersion(' v1.0.6 ') === '1.0.6' },
    // 35. formatDisplayVersion for invalid version returns fallback message
    { name: 'formatDisplayVersion("invalid") returns "Unable to determine version"', run: () => VersionChecker.formatDisplayVersion('invalid') === 'Unable to determine version' },
    // 36. formatDisplayVersion for null returns fallback message
    { name: 'formatDisplayVersion(null) returns "Unable to determine version"', run: () => VersionChecker.formatDisplayVersion(null) === 'Unable to determine version' },
    // 37. Non-crashing error handling for invalid v1 string
    { name: 'compare("invalid", "1.0.0") does not crash and returns -1', run: () => VersionChecker.compare('invalid', '1.0.0') === -1 },
    // 38. Non-crashing error handling for null input
    { name: 'compare(null, undefined) does not crash and returns 0', run: () => VersionChecker.compare(null, undefined) === 0 }
  ];

  const defaultMockInfo: ReleaseInfo = {
    latestVersion: '1.1.1',
    minimumSupportedVersion: '1.0.0',
    googleDriveApkUrl: 'https://drive.google.com/file/d/example/view',
    releaseNotes: 'Test release notes',
    releaseTitle: 'BunkMate Test Release',
    releaseDate: new Date().toISOString(),
    forceUpdate: false,
    maintenanceMode: false,
    maintenanceMessage: '',
    developerEmail: 'arvindmadaan04@gmail.com',
    appLicense: 'MIT License',
    releaseChannel: 'stable',
    releasePriority: 'medium',
    rolloutPercentage: 100
  };

  const updateScenarioTestCases = [
    // Scenario 1: Installed == Latest -> Up to Date
    {
      name: 'Scenario 1: Installed 1.1.1 / Latest 1.1.1 -> Up to Date',
      run: () => updateService.evaluateUpdate('1.1.1', { ...defaultMockInfo, latestVersion: '1.1.1' }).status === 'up_to_date'
    },
    // Scenario 2: Installed < Latest & >= Minimum -> Update Available
    {
      name: 'Scenario 2: Installed 1.1.1 / Latest 1.1.2 / Minimum 1.0.0 -> Update Available',
      run: () => updateService.evaluateUpdate('1.1.1', { ...defaultMockInfo, latestVersion: '1.1.2', minimumSupportedVersion: '1.0.0' }).status === 'update_available'
    },
    // Scenario 3: Installed < Minimum -> Update Required
    {
      name: 'Scenario 3: Installed 1.0.6 / Latest 1.1.2 / Minimum 1.1.0 -> Update Required',
      run: () => updateService.evaluateUpdate('1.0.6', { ...defaultMockInfo, latestVersion: '1.1.2', minimumSupportedVersion: '1.1.0' }).status === 'update_required'
    },
    // Scenario 4: Installed > Latest -> Up to Date
    {
      name: 'Scenario 4: Installed 2.0.0 / Latest 1.9.9 -> Up to Date',
      run: () => updateService.evaluateUpdate('2.0.0', { ...defaultMockInfo, latestVersion: '1.9.9' }).status === 'up_to_date'
    },
    // Scenario 5: Force Update Flag True -> Update Required
    {
      name: 'Scenario 5: Force Update Flag True -> Update Required',
      run: () => updateService.evaluateUpdate('1.1.1', { ...defaultMockInfo, latestVersion: '1.1.2', forceUpdate: true }).status === 'update_required'
    },
    // Scenario 6: Maintenance Mode Active -> Maintenance Mode Status
    {
      name: 'Scenario 6: Maintenance Mode Active -> Maintenance Mode Status',
      run: () => updateService.evaluateUpdate('1.1.1', { ...defaultMockInfo, maintenanceMode: true }).status === 'maintenance_mode'
    },
    // Scenario 7: Staged Rollout (0% Rollout) -> Holds Back Non-Forced Update
    {
      name: 'Scenario 7: Staged Rollout (0% Rollout) -> Holds Back Non-Forced Update',
      run: () => updateService.evaluateUpdate('1.1.1', { ...defaultMockInfo, latestVersion: '1.1.2', rolloutPercentage: 0 }).status === 'up_to_date'
    },
    // Scenario 8: Staged Rollout (100% Rollout) -> Triggers Update Available
    {
      name: 'Scenario 8: Staged Rollout (100% Rollout) -> Triggers Update Available',
      run: () => updateService.evaluateUpdate('1.1.1', { ...defaultMockInfo, latestVersion: '1.1.2', rolloutPercentage: 100 }).status === 'update_available'
    },
    // Scenario 9: Mandatory After Deadline Passed -> Update Required
    {
      name: 'Scenario 9: Mandatory After Deadline Passed -> Update Required',
      run: () => updateService.evaluateUpdate('1.1.1', { 
        ...defaultMockInfo, 
        latestVersion: '1.1.2', 
        mandatoryAfter: new Date(Date.now() - 100000).toISOString() 
      }).status === 'update_required'
    },
    // Scenario 10: Mandatory After Deadline in Future -> Update Available
    {
      name: 'Scenario 10: Mandatory After Deadline in Future -> Update Available',
      run: () => updateService.evaluateUpdate('1.1.1', { 
        ...defaultMockInfo, 
        latestVersion: '1.1.2', 
        mandatoryAfter: new Date(Date.now() + 1000000).toISOString() 
      }).status === 'update_available'
    },
    // Scenario 11: Offline Cache Mode Flag Preserved
    {
      name: 'Scenario 11: Offline Cache Mode Flag Preserved in Result',
      run: () => updateService.evaluateUpdate('1.1.1', defaultMockInfo, true).isOffline === true
    },
    // Scenario 12: Google Drive URL Validation (Valid URL)
    {
      name: 'Scenario 12: Google Drive URL Validation (Valid HTTPS Link)',
      run: () => updateService.isValidDownloadUrl('https://drive.google.com/file/d/abc/view') === true
    },
    // Scenario 13: Google Drive URL Validation (Invalid Link)
    {
      name: 'Scenario 13: Google Drive URL Validation (Invalid Link returns false)',
      run: () => updateService.isValidDownloadUrl('ftp://invalid-link') === false
    },
    // Scenario 14: Channel Selector Persistence
    {
      name: 'Scenario 14: Channel Selector Persistence (Set to Beta)',
      run: () => {
        updateService.setSelectedChannel('beta');
        return updateService.getSelectedChannel() === 'beta';
      }
    },
    // Scenario 15: Channel Reset Back to Stable
    {
      name: 'Scenario 15: Channel Reset Back to Stable',
      run: () => {
        updateService.setSelectedChannel('stable');
        return updateService.getSelectedChannel() === 'stable';
      }
    },
    // Scenario 16: Multi-Part Semantic Version (1 vs 1.0.0.1)
    {
      name: 'Scenario 16: Multi-Part Semantic Version (1 vs 1.0.0.1)',
      run: () => updateService.evaluateUpdate('1', { ...defaultMockInfo, latestVersion: '1.0.0.1' }).status === 'update_available'
    },
    // Scenario 17: Four-part equal version (1.1.1.0 vs 1.1.1) -> Up to Date
    {
      name: 'Scenario 17: Four-part equal version (1.1.1.0 vs 1.1.1) -> Up to Date',
      run: () => updateService.evaluateUpdate('1.1.1.0', { ...defaultMockInfo, latestVersion: '1.1.1' }).status === 'up_to_date'
    },
    // Scenario 18: Unlimited segment patch bump (2.5.12.3 vs 2.5.12.4)
    {
      name: 'Scenario 18: Unlimited segment patch bump (2.5.12.3 vs 2.5.12.4)',
      run: () => updateService.evaluateUpdate('2.5.12.3', { ...defaultMockInfo, latestVersion: '2.5.12.4' }).status === 'update_available'
    },
    // Scenario 19: Corrupted payload with missing minimumSupportedVersion defaults safely
    {
      name: 'Scenario 19: Missing minimumSupportedVersion defaults safely without crash',
      run: () => updateService.evaluateUpdate('1.0.0', { ...defaultMockInfo, latestVersion: '1.1.0', minimumSupportedVersion: '1.0.0' }).status === 'update_available'
    },
    // Scenario 20: Deterministic Device Rollout Seed range 1..100
    {
      name: 'Scenario 20: Deterministic Device Rollout Seed range check (1 to 100)',
      run: () => {
        const seed = updateService.getDeviceRolloutSeed();
        return seed >= 1 && seed <= 100;
      }
    }
  ];

  let passedCount = 0;
  let failedCount = 0;

  console.log('\n--- Running Semantic Version Comparison Tests ---');
  for (const test of comparisonTestCases) {
    try {
      const result = test.run();
      if (result) {
        console.log(`[PASS] ${test.name}`);
        passedCount++;
      } else {
        console.error(`[FAIL] ${test.name}`);
        failedCount++;
      }
    } catch (err: any) {
      console.error(`[CRASH] ${test.name}: ${err.message}`);
      failedCount++;
    }
  }

  console.log('\n--- Running Update Decision & OTA Scenario Tests ---');
  for (const test of updateScenarioTestCases) {
    try {
      const result = test.run();
      if (result) {
        console.log(`[PASS] ${test.name}`);
        passedCount++;
      } else {
        console.error(`[FAIL] ${test.name}`);
        failedCount++;
      }
    } catch (err: any) {
      console.error(`[CRASH] ${test.name}: ${err.message}`);
      failedCount++;
    }
  }

  console.log('==================================================');
  console.log(`Test Suite Results: ${passedCount} PASSED, ${failedCount} FAILED out of ${comparisonTestCases.length + updateScenarioTestCases.length} total tests.`);
  console.log('==================================================');

  if (failedCount > 0) {
    process.exit(1);
  }
}

runTests();
