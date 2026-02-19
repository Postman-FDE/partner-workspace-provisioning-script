package com.postman.sdk.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Configuration properties for Postman SDK
 */
@ConfigurationProperties(prefix = "postman")
public class PostmanClientConfig {

    private String apiKey;
    private String baseUrl = "https://api.getpostman.com";
    private int timeoutSeconds = 30;
    private int retryAttempts = 3;
    private long retryDelayMs = 1000;

    public String getApiKey() {
        return apiKey;
    }

    public void setApiKey(String apiKey) {
        this.apiKey = apiKey;
    }

    public String getBaseUrl() {
        return baseUrl;
    }

    public void setBaseUrl(String baseUrl) {
        this.baseUrl = baseUrl;
    }

    public int getTimeoutSeconds() {
        return timeoutSeconds;
    }

    public void setTimeoutSeconds(int timeoutSeconds) {
        this.timeoutSeconds = timeoutSeconds;
    }

    public int getRetryAttempts() {
        return retryAttempts;
    }

    public void setRetryAttempts(int retryAttempts) {
        this.retryAttempts = retryAttempts;
    }

    public long getRetryDelayMs() {
        return retryDelayMs;
    }

    public void setRetryDelayMs(long retryDelayMs) {
        this.retryDelayMs = retryDelayMs;
    }
}
