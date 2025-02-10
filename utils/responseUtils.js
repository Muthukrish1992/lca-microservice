// utils/responseUtils.js

const formatSuccess = (data, message = null) => ({
    success: true,
    ...(data && { data }),
    ...(message && { message })
});

const formatError = (message, status = 500) => ({
    success: false,
    message,
    status
});

module.exports = {
    formatSuccess,
    formatError
};