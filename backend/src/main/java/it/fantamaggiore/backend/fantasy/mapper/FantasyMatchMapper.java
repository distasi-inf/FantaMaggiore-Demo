package it.fantamaggiore.backend.fantasy.mapper;

import it.fantamaggiore.backend.fantasy.dto.FantasyMatchResponseDTO;
import it.fantamaggiore.backend.fantasy.model.FantasyMatch;
import org.springframework.stereotype.Component;

@Component
public class FantasyMatchMapper {

    public FantasyMatchResponseDTO toDTO(FantasyMatch match) {
        if (match == null) return null;

        FantasyMatchResponseDTO dto = new FantasyMatchResponseDTO();
        dto.setId(match.getId());
        dto.setCalculated(match.isCalculated());
        dto.setScoreUser1(match.getScoreUser1());
        dto.setScoreUser2(match.getScoreUser2());
        dto.setGoalsUser1(match.getGoalsUser1());
        dto.setGoalsUser2(match.getGoalsUser2());

        if (match.getMatchDay() != null) {
            dto.setMatchDayId(match.getMatchDay().getId());
            dto.setMatchDayDescription(match.getMatchDay().getDescription());
        }

        // Estraiamo in modo sicuro i dati dell'Utente 1
        if (match.getUser1() != null) {
            dto.setUser1Id(match.getUser1().getId());
            dto.setUser1FantasyTeamName(match.getUser1().getFantasyTeamName());
            dto.setUser1OwnerName(match.getUser1().getName() + " " + match.getUser1().getSurname());
            dto.setUser1Username(match.getUser1().getUsername());
        }

        // Estraiamo in modo sicuro i dati dell'Utente 2
        if (match.getUser2() != null) {
            dto.setUser2Id(match.getUser2().getId());
            dto.setUser2FantasyTeamName(match.getUser2().getFantasyTeamName());
            dto.setUser2OwnerName(match.getUser2().getName() + " " + match.getUser2().getSurname());
            dto.setUser2Username(match.getUser2().getUsername());
        }

        return dto;
    }
}