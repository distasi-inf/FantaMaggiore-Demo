package it.fantamaggiore.backend.core.exceptions;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.time.LocalDateTime;

@RestControllerAdvice
public class GlobalExceptionHandler {

    //GESTIONE DELL'ERRORE 404 (Dato non trovato)
    @ExceptionHandler(ResourceNotFoundException.class)
    public ResponseEntity<ErrorResponseDTO> handleResourceNotFound(ResourceNotFoundException ex) {

        // Costruisco il "pacco" da spedire al frontend
        ErrorResponseDTO errorDTO = new ErrorResponseDTO(
                LocalDateTime.now(),            // timestamp: Orario esatto
                HttpStatus.NOT_FOUND.value(),   // status: 404
                "Not Found",                    // error: Nome dell'errore
                ex.getMessage()                 // message: Es. "User not found"
        );

        // Spedisco il pacco con l'etichetta 404
        return new ResponseEntity<>(errorDTO, HttpStatus.NOT_FOUND);
    }

    //GESTIONE DELL'ERRORE 400 (Azione non valida / Regola infranta)
    @ExceptionHandler(InvalidActionException.class)
    public ResponseEntity<ErrorResponseDTO> handleInvalidAction(InvalidActionException ex) {

        ErrorResponseDTO errorDTO = new ErrorResponseDTO(
                LocalDateTime.now(),
                HttpStatus.BAD_REQUEST.value(), // status: 400
                "Bad Request - Azione non consentita",
                ex.getMessage()                 // message: Es. "Closed market!"
        );

        return new ResponseEntity<>(errorDTO, HttpStatus.BAD_REQUEST);
    }

    //RETE DI SALVATAGGIO (Gestione di tutti gli altri errori inaspettati - 500)
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponseDTO> handleGenericException(Exception ex) {

        ex.printStackTrace();

        ErrorResponseDTO errorDTO = new ErrorResponseDTO(
                LocalDateTime.now(),
                HttpStatus.INTERNAL_SERVER_ERROR.value(), // status: 500
                "Errore Interno del Server",
                "Si è verificato un problema inaspettato. Riprova più tardi."
        );

        return new ResponseEntity<>(errorDTO, HttpStatus.INTERNAL_SERVER_ERROR);
    }

    //GESTIONE DELL'ERRORE 404 (Credenziali invalide)
    @ExceptionHandler(InvalidCredentialsException.class)
    public ResponseEntity<ErrorResponseDTO> handleInvalidCredentials(InvalidCredentialsException ex) {

        ErrorResponseDTO errorDTO = new ErrorResponseDTO(
                LocalDateTime.now(),            // timestamp: Orario esatto
                HttpStatus.UNAUTHORIZED.value(),   // status: 401
                "Not Found",                    // error: Nome dell'errore
                ex.getMessage()                 // message: "Invalid credentials"
        );

        return new ResponseEntity<>(errorDTO, HttpStatus.UNAUTHORIZED);
    }
}
