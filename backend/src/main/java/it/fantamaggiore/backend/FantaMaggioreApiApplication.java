package it.fantamaggiore.backend;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cache.annotation.EnableCaching;

@SpringBootApplication
@EnableCaching
public class FantaMaggioreApiApplication {

	public static void main(String[] args) {
		SpringApplication.run(FantaMaggioreApiApplication.class, args);
	}

}
