package it.fantamaggiore.backend.core.mapper;

import it.fantamaggiore.backend.core.dto.MatchDayRequestDTO;
import it.fantamaggiore.backend.core.dto.MatchDayResponseDTO;
import it.fantamaggiore.backend.core.model.MatchDay;
import it.fantamaggiore.backend.core.model.Player;
import org.springframework.stereotype.Component;

@Component
public class MatchDayMapper {

    public MatchDay toEntity(MatchDayRequestDTO matchDayDTO) {
        if (matchDayDTO == null) return null;

        MatchDay matchDay = new MatchDay();
        matchDay.setDescription(matchDayDTO.getDescription());
        matchDay.setDate(matchDayDTO.getDate());
        matchDay.setDeadline(matchDayDTO.getDeadline());

        return matchDay;
    }

    public MatchDayResponseDTO toDTO(MatchDay matchDay) {
        if (matchDay == null) return null;

        MatchDayResponseDTO matchDayDTO = new MatchDayResponseDTO();
        matchDayDTO.setId(matchDay.getId());
        matchDayDTO.setDescription(matchDay.getDescription());
        matchDayDTO.setDate(matchDay.getDate());
        matchDayDTO.setDeadline(matchDay.getDeadline());
        matchDayDTO.setStatus(matchDay.getStatus());

        if (matchDay.getAvailablePlayers() != null) {
            matchDayDTO.setAvailablePlayerIds(
                    matchDay.getAvailablePlayers().stream()
                            .map(Player::getId)
                            .toList()
            );
        }

        return matchDayDTO;
    }
}
