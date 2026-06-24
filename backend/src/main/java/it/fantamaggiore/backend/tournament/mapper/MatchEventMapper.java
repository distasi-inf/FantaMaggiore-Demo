package it.fantamaggiore.backend.tournament.mapper;

import it.fantamaggiore.backend.tournament.dto.MatchEventResponseDTO;
import it.fantamaggiore.backend.tournament.model.MatchEvent;
import org.springframework.stereotype.Component;

@Component
public class MatchEventMapper {

    public MatchEventResponseDTO toDTO(MatchEvent event) {
        if (event == null) return null;

        MatchEventResponseDTO eventDTO = new MatchEventResponseDTO();
        eventDTO.setId(event.getId());
        eventDTO.setMatchMinute(event.getMatchMinute());
        eventDTO.setTimestamp(event.getTimestamp());
        eventDTO.setValue(event.getValue());
        eventDTO.setType(event.getType());
        if (event.getMatch() != null) {
            eventDTO.setMatchId(event.getMatch().getId());
        }
        if (event.getPlayer() != null) {
            eventDTO.setPlayerId(event.getPlayer().getId());
            eventDTO.setPlayerName(event.getPlayer().getName() + " " + event.getPlayer().getSurname());
        }

        if (event.getAssistPlayer() != null) {
            eventDTO.setAssistPlayerId(event.getAssistPlayer().getId());
            eventDTO.setAssistPlayerName(event.getAssistPlayer().getName() + " " + event.getAssistPlayer().getSurname());
        }

        return eventDTO;
    }
}
