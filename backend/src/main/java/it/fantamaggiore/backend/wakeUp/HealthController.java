package it.fantamaggiore.backend.wakeUp;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class HealthController {

    @GetMapping("/health")
    public ResponseEntity<String> healthCheck() {
        // Questa risposta verrà letta da UptimeRobot
        return ResponseEntity.ok("Sono sveglio e pronto per il Fanta-Maggiore!");
    }
}
