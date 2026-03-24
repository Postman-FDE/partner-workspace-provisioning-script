package com.postman.sdk.config;

import com.postman.sdk.client.PostmanClient;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.reactive.function.client.WebClient;

/**
 * Auto-configuration for Postman SDK
 */
@Configuration
@EnableConfigurationProperties(PostmanClientConfig.class)
@ConditionalOnProperty(prefix = "postman", name = "api-key")
public class PostmanAutoConfiguration {

    @Bean
    @ConditionalOnMissingBean
    public WebClient postmanWebClient(PostmanClientConfig config) {
        return WebClient.builder()
            .baseUrl(config.getBaseUrl())
            .defaultHeader("Content-Type", "application/json")
            .defaultHeader("X-Api-Key", config.getApiKey())
            .build();
    }

    @Bean
    @ConditionalOnMissingBean
    public PostmanClient postmanClient(WebClient postmanWebClient, PostmanClientConfig config) {
        return new PostmanClient(postmanWebClient, config);
    }
}
