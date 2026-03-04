package com.postman.sdk.client;

/**
 * Custom exception for Postman API errors
 */
public class PostmanApiException extends RuntimeException {

    private final Integer statusCode;
    private final String details;

    public PostmanApiException(String message) {
        super(message);
        this.statusCode = null;
        this.details = null;
    }

    public PostmanApiException(String message, Integer statusCode) {
        super(message);
        this.statusCode = statusCode;
        this.details = null;
    }

    public PostmanApiException(String message, Integer statusCode, String details) {
        super(message);
        this.statusCode = statusCode;
        this.details = details;
    }

    public PostmanApiException(String message, Throwable cause) {
        super(message, cause);
        this.statusCode = null;
        this.details = null;
    }

    public Integer getStatusCode() {
        return statusCode;
    }

    public String getDetails() {
        return details;
    }
}
