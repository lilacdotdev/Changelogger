// Demo application for Changelogger extension
console.log('Hello, Changelogger Demo!');

function greetUser(name) {
    return `Welcome, ${name}!`;
}

function calculateSum(a, b) {
    return a + b;
}

function calculateProduct(a, b) {
    return a * b;
}

function formatMessage(message, timestamp = new Date()) {
    return `[${timestamp.toISOString()}] ${message}`;
}

// Export functions for testing
module.exports = {
    greetUser,
    calculateSum,
    calculateProduct,
    formatMessage
}; 