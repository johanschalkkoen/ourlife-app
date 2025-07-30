const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const axios = require('axios');

const DB_PATH = './ourlife.db';
const API_BASE = '/api';
const STANDARD_PASSWORD = '1234567890';
const ADMIN_USERNAME = 'admin';
const USER_USERNAME = 'admin';

async function resetUsers() {
    console.log('Resetting database...');
    const db = new sqlite3.Database(DB_PATH, (err) => {
        if (err) {
            console.error('Error connecting to database:', err.message);
            process.exit(1);
        }
    });

    try {
        // Create tables if they don't exist
        await new Promise((resolve, reject) => {
            db.run(`CREATE TABLE IF NOT EXISTS users (
                username TEXT PRIMARY KEY,
                password TEXT NOT NULL,
                isAdmin INTEGER DEFAULT 0,
                profilePicUrl TEXT,
                email TEXT,
                phone TEXT,
                address TEXT,
                eventColor TEXT
            )`, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
        console.log('Users table checked/created.');

        await new Promise((resolve, reject) => {
            db.run(`CREATE TABLE IF NOT EXISTS access (
                viewer TEXT,
                target TEXT,
                PRIMARY KEY (viewer, target),
                FOREIGN KEY (viewer) REFERENCES users(username),
                FOREIGN KEY (target) REFERENCES users(username)
            )`, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
        console.log('Access table checked/created.');

        await new Promise((resolve, reject) => {
            db.run(`CREATE TABLE IF NOT EXISTS financial (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user TEXT,
                description TEXT,
                amount REAL,
                type TEXT,
                date TEXT
            )`, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
        console.log('Financial table checked/created.');

        await new Promise((resolve, reject) => {
            db.run(`CREATE TABLE IF NOT EXISTS calendar (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user TEXT,
                title TEXT,
                date TEXT,
                financial INTEGER,
                type TEXT,
                amount REAL,
                eventColor TEXT
            )`, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
        console.log('Calendar table checked/created.');

        // Clear tables
        await new Promise((resolve, reject) => {
            db.run('DELETE FROM financial', (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
        console.log('Cleared financial table.');

        await new Promise((resolve, reject) => {
            db.run('DELETE FROM calendar', (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
        console.log('Cleared calendar table.');

        await new Promise((resolve, reject) => {
            db.run('DELETE FROM access', (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
        console.log('Cleared access table.');

        await new Promise((resolve, reject) => {
            db.run('DELETE FROM users', (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
        console.log('Cleared users table.');

        // Create admin and schalk with standard password
        const hashedPassword = await bcrypt.hash(STANDARD_PASSWORD, 10);
        await new Promise((resolve, reject) => {
            db.run(
                'INSERT INTO users (username, password, isAdmin) VALUES (?, ?, ?)',
                [ADMIN_USERNAME, hashedPassword, 1],
                (err) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });
        console.log(`Created user: ${ADMIN_USERNAME} (isAdmin: 1)`);

        await new Promise((resolve, reject) => {
            db.run(
                'INSERT INTO users (username, password, isAdmin) VALUES (?, ?, ?)',
                [USER_USERNAME, hashedPassword, 0],
                (err) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });
        console.log(`Created user: ${USER_USERNAME} (isAdmin: 0)`);
    } catch (error) {
        console.error('Error resetting database:', error.message);
        process.exit(1);
    } finally {
        db.close();
    }
}

async function runTests() {
    console.log('\nRunning endpoint tests...');
    let testResults = [];
    let adminUsername = null;

    // Helper to log test results
    const logTest = (name, success, message) => {
        testResults.push({ name, success, message });
        console.log(`Test: ${name} - ${success ? 'PASS' : 'FAIL'} - ${message}`);
    };

    // Authentication Tests
    console.log('\n--- Authentication Tests ---');
    try {
        const loginResponse = await axios.post(`${API_BASE}/login`, {
            username: ADMIN_USERNAME,
            password: STANDARD_PASSWORD
        });
        if (loginResponse.data.success && loginResponse.data.username === ADMIN_USERNAME && loginResponse.data.isAdmin) {
            logTest('Login (correct credentials)', true, 'Successfully logged in as admin');
            adminUsername = ADMIN_USERNAME; // Use username instead of token
        } else {
            logTest('Login (correct credentials)', false, `Unexpected response: ${JSON.stringify(loginResponse.data)}`);
        }
    } catch (error) {
        logTest('Login (correct credentials)', false, `Error: ${error.response?.data?.message || error.message}`);
    }

    try {
        const loginFailResponse = await axios.post(`${API_BASE}/login`, {
            username: ADMIN_USERNAME,
            password: 'wrongpassword'
        });
        if (!loginFailResponse.data.success && loginFailResponse.data.message.includes('Incorrect password')) {
            logTest('Login (incorrect password)', true, 'Correctly rejected incorrect password');
        } else {
            logTest('Login (incorrect password)', false, `Unexpected response: ${JSON.stringify(loginFailResponse.data)}`);
        }
    } catch (error) {
        logTest('Login (incorrect password)', false, `Error: ${error.response?.data?.message || error.message}`);
    }

    try {
        const loginNonExistentResponse = await axios.post(`${API_BASE}/login`, {
            username: 'nonexistent',
            password: STANDARD_PASSWORD
        });
        if (!loginNonExistentResponse.data.success && loginNonExistentResponse.data.message.includes('User not found')) {
            logTest('Login (non-existent user)', true, 'Correctly rejected non-existent user');
        } else {
            logTest('Login (non-existent user)', false, `Unexpected response: ${JSON.stringify(loginNonExistentResponse.data)}`);
        }
    } catch (error) {
        logTest('Login (non-existent user)', false, `Error: ${error.response?.data?.message || error.message}`);
    }

    // Endpoint Tests (require admin)
    if (!adminUsername) {
        console.error('Skipping endpoint tests: Admin login failed.');
        return testResults;
    }

    try {
        const usersResponse = await axios.get(`${API_BASE}/users`, { params: { adminUsername: adminUsername } });
        if (usersResponse.data.success && Array.isArray(usersResponse.data.data)) {
            logTest('Get Users', true, `Retrieved ${usersResponse.data.data.length} users`);
        } else {
            logTest('Get Users', false, `Unexpected response: ${JSON.stringify(usersResponse.data)}`);
        }
    } catch (error) {
        logTest('Get Users', false, `Error: ${error.response?.data?.message || error.message}`);
    }

    try {
        const addUserResponse = await axios.post(
            `${API_BASE}/add-user`,
            { username: 'testuser', password: 'TestPass123' },
            { params: { adminUsername: adminUsername } }
        );
        if (addUserResponse.data.success) {
            logTest('Add User', true, 'User added successfully');
        } else {
            logTest('Add User', false, `Unexpected response: ${JSON.stringify(addUserResponse.data)}`);
        }
    } catch (error) {
        logTest('Add User', false, `Error: ${error.response?.data?.message || error.message}`);
    }

    try {
        const accessResponse = await axios.get(`${API_BASE}/get-access`, { params: { adminUsername: adminUsername } });
        if (accessResponse.data.success && Array.isArray(accessResponse.data.accessList)) {
            logTest('Get Access List', true, `Retrieved ${accessResponse.data.accessList.length} access entries`);
        } else {
            logTest('Get Access List', false, `Unexpected response: ${JSON.stringify(accessResponse.data)}`);
        }
    } catch (error) {
        logTest('Get Access List', false, `Error: ${error.response?.data?.message || error.message}`);
    }

    try {
        const grantAccessResponse = await axios.post(
            `${API_BASE}/grant-access`,
            { viewer: 'testuser', target: USER_USERNAME },
            { params: { adminUsername: adminUsername } }
        );
        if (grantAccessResponse.data.success) {
            logTest('Grant Access', true, `Access granted for testuser to view ${USER_USERNAME}`);
        } else {
            logTest('Grant Access', false, `Unexpected response: ${JSON.stringify(grantAccessResponse.data)}`);
        }
    } catch (error) {
        logTest('Grant Access', false, `Error: ${error.response?.data?.message || error.message}`);
    }

    try {
        const revokeAccessResponse = await axios.post(
            `${API_BASE}/revoke-access`,
            { viewer: 'testuser', target: USER_USERNAME },
            { params: { adminUsername: adminUsername } }
        );
        if (revokeAccessResponse.data.success) {
            logTest('Revoke Access', true, `Access revoked for testuser to view ${USER_USERNAME}`);
        } else {
            logTest('Revoke Access', false, `Unexpected response: ${JSON.stringify(revokeAccessResponse.data)}`);
        }
    } catch (error) {
        logTest('Revoke Access', false, `Error: ${error.response?.data?.message || error.message}`);
    }

    try {
        const profileResponse = await axios.post(`${API_BASE}/profile-pictures`, {
            username: USER_USERNAME,
            profilePicUrl: 'https://example.com/profile.jpg',
            email: 'schalk@example.com',
            phone: '1234567890',
            address: '123 Main St',
            eventColor: '#ff0000'
        });
        if (profileResponse.data.success) {
            logTest('Update Profile', true, 'Profile updated successfully');
        } else {
            logTest('Update Profile', false, `Unexpected response: ${JSON.stringify(profileResponse.data)}`);
        }
    } catch (error) {
        logTest('Update Profile', false, `Error: ${error.response?.data?.message || error.message}`);
    }

    try {
        const getProfileResponse = await axios.get(`${API_BASE}/profile-pictures`, { params: { username: USER_USERNAME } });
        if (getProfileResponse.data.success && getProfileResponse.data.email === 'schalk@example.com') {
            logTest('Get Profile', true, 'Profile retrieved successfully');
        } else {
            logTest('Get Profile', false, `Unexpected response: ${JSON.stringify(getProfileResponse.data)}`);
        }
    } catch (error) {
        logTest('Get Profile', false, `Error: ${error.response?.data?.message || error.message}`);
    }

    try {
        const grantAdminResponse = await axios.post(
            `${API_BASE}/grant-admin`,
            { username: USER_USERNAME },
            { params: { adminUsername: adminUsername } }
        );
        if (grantAdminResponse.data.success) {
            logTest('Grant Admin', true, `Admin access granted for ${USER_USERNAME}`);
        } else {
            logTest('Grant Admin', false, `Unexpected response: ${JSON.stringify(grantAdminResponse.data)}`);
        }
    } catch (error) {
        logTest('Grant Admin', false, `Error: ${error.response?.data?.message || error.message}`);
    }

    try {
        const revokeAdminResponse = await axios.post(
            `${API_BASE}/revoke-admin`,
            { username: USER_USERNAME },
            { params: { adminUsername: adminUsername } }
        );
        if (revokeAdminResponse.data.success) {
            logTest('Revoke Admin', true, `Admin access revoked for ${USER_USERNAME}`);
        } else {
            logTest('Revoke Admin', false, `Unexpected response: ${JSON.stringify(revokeAdminResponse.data)}`);
        }
    } catch (error) {
        logTest('Revoke Admin', false, `Error: ${error.response?.data?.message || error.message}`);
    }

    try {
        const updatePasswordResponse = await axios.post(
            `${API_BASE}/admin-update-password`,
            { username: USER_USERNAME, newPassword: 'NewPass123' },
            { params: { adminUsername: adminUsername } }
        );
        if (updatePasswordResponse.data.success) {
            logTest('Admin Update Password', true, `Password updated for ${USER_USERNAME}`);
        } else {
            logTest('Admin Update Password', false, `Unexpected response: ${JSON.stringify(updatePasswordResponse.data)}`);
        }
    } catch (error) {
        logTest('Admin Update Password', false, `Error: ${error.response?.data?.message || error.message}`);
    }

    try {
        const financialAddResponse = await axios.post(`${API_BASE}/financial`, {
            user: USER_USERNAME,
            description: 'Test Expense',
            amount: 100.50,
            type: 'expense',
            date: '2025-07-22'
        });
        if (financialAddResponse.data.success) {
            logTest('Financial Add', true, 'Financial item added successfully');
        } else {
            logTest('Financial Add', false, `Unexpected response: ${JSON.stringify(financialAddResponse.data)}`);
        }
    } catch (error) {
        logTest('Financial Add', false, `Error: ${error.response?.data?.message || error.message}`);
    }

    try {
        const financialGetResponse = await axios.get(`${API_BASE}/financial`, { params: { user: USER_USERNAME } });
        if (Array.isArray(financialGetResponse.data) && financialGetResponse.data.length > 0) {
            logTest('Financial Get', true, `Retrieved ${financialGetResponse.data.length} financial items`);
        } else {
            logTest('Financial Get', false, `Unexpected response: ${JSON.stringify(financialGetResponse.data)}`);
        }
    } catch (error) {
        logTest('Financial Get', false, `Error: ${error.response?.data?.message || error.message}`);
    }

    try {
        const calendarAddResponse = await axios.post(`${API_BASE}/calendar`, {
            user: USER_USERNAME,
            title: 'Test Event',
            date: '2025-07-22',
            financial: 0,
            type: 'event',
            amount: 0,
            eventColor: '#ff0000'
        });
        if (calendarAddResponse.data.success) {
            logTest('Calendar Add', true, 'Calendar event added successfully');
        } else {
            logTest('Calendar Add', false, `Unexpected response: ${JSON.stringify(calendarAddResponse.data)}`);
        }
    } catch (error) {
        logTest('Calendar Add', false, `Error: ${error.response?.data?.message || error.message}`);
    }

    try {
        const calendarGetResponse = await axios.get(`${API_BASE}/calendar`, { params: { user: USER_USERNAME } });
        if (Array.isArray(calendarGetResponse.data) && calendarGetResponse.data.length > 0) {
            logTest('Calendar Get', true, `Retrieved ${calendarGetResponse.data.length} calendar events`);
        } else {
            logTest('Calendar Get', false, `Unexpected response: ${JSON.stringify(calendarGetResponse.data)}`);
        }
    } catch (error) {
        logTest('Calendar Get', false, `Error: ${error.response?.data?.message || error.message}`);
    }

    try {
        const deleteUserResponse = await axios.delete(`${API_BASE}/delete-user/testuser`, { params: { adminUsername: adminUsername } });
        if (deleteUserResponse.data.success) {
            logTest('Delete User', true, 'User deleted successfully');
        } else {
            logTest('Delete User', false, `Unexpected response: ${JSON.stringify(deleteUserResponse.data)}`);
        }
    } catch (error) {
        logTest('Delete User', false, `Error: ${error.response?.data?.message || error.message}`);
    }

    return testResults;
}

async function main() {
    try {
        await resetUsers();
        const results = await runTests();
        console.log('\n--- Test Summary ---');
        const passed = results.filter(r => r.success).length;
        const total = results.length;
        console.log(`Passed: ${passed}/${total}`);
        results.forEach(r => {
            console.log(`${r.success ? '✓' : '✗'} ${r.name}: ${r.message}`);
        });
        if (passed === total) {
            console.log('All tests passed successfully!');
        } else {
            console.error('Some tests failed. Check logs above for details.');
            process.exit(1);
        }
    } catch (error) {
        console.error('Script failed:', error.message);
        process.exit(1);
    }
}

main();
