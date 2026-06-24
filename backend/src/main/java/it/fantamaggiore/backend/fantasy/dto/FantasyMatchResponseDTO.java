package it.fantamaggiore.backend.fantasy.dto;

import lombok.Data;

@Data
public class FantasyMatchResponseDTO {

    private Long id;

    // Info sulla Giornata
    private Long matchDayId;
    private String matchDayDescription;

    // Info dello Sfidante 1 (In casa)
    private Long user1Id;
    private String user1FantasyTeamName;
    private String user1OwnerName;
    private String user1Username;
    private Double scoreUser1;
    private Integer goalsUser1;

    // Info dello Sfidante 2 (In trasferta)
    private Long user2Id;
    private String user2FantasyTeamName;
    private String user2OwnerName;
    private String user2Username;
    private Double scoreUser2;
    private Integer goalsUser2;

    // Stato della partita
    private boolean isCalculated;
}