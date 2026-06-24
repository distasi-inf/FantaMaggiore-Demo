package it.fantamaggiore.backend.fantasy.mapper;

import it.fantamaggiore.backend.core.model.User;
import it.fantamaggiore.backend.fantasy.dto.BetRequestDTO;
import it.fantamaggiore.backend.fantasy.dto.BetResponseDTO;
import it.fantamaggiore.backend.fantasy.model.Bet;
import it.fantamaggiore.backend.fantasy.model.enums.PredictionType;
import org.springframework.stereotype.Component;

@Component
public class BetMapper {

    public Bet toEntity(BetRequestDTO dto) {
        if (dto == null) return null;
        Bet bet = new Bet();
        bet.setDescription(dto.getDescription());
        return bet;
    }

    public BetResponseDTO toDTO(Bet bet, User currentUser) {
        if (bet == null) return null;

        BetResponseDTO betDTO = new BetResponseDTO();
        betDTO.setId(bet.getId());
        betDTO.setDescription(bet.getDescription());
        betDTO.setStatus(bet.getStatus());

        if (bet.getCreator() != null) {
            betDTO.setCreatorId(bet.getCreator().getId());
            betDTO.setCreatorName(bet.getCreator().getName() + " " + bet.getCreator().getSurname());

            // 🔥 Valorizziamo isCreator
            if (currentUser != null) {
                betDTO.setIsCreator(bet.getCreator().getId().equals(currentUser.getId()));
            } else {
                betDTO.setIsCreator(false);
            }
        } else {
            betDTO.setIsCreator(false);
        }

        if (bet.getMatchDay() != null) {
            betDTO.setMatchDayId(bet.getMatchDay().getId());
        }

        if (bet.getPredictions() != null) {
            // 🔥 FIX: Creiamo una lista solo con le puntate degli utenti NON bannati
            var validPredictions = bet.getPredictions().stream()
                    .filter(p -> !p.getUser().isLocked())
                    .toList();

            // Usiamo validPredictions invece di bet.getPredictions() per tutti i conteggi!
            betDTO.setParticipantCount(validPredictions.size());

            long yesCount = validPredictions.stream()
                    .filter(p -> p.getPrediction() == PredictionType.YES)
                    .count();
            long noCount = validPredictions.stream()
                    .filter(p -> p.getPrediction() == PredictionType.NO)
                    .count();

            betDTO.setYesCount((int) yesCount);
            betDTO.setNoCount((int) noCount);

            if (currentUser != null) {
                // Cerchiamo il voto dell'utente corrente sempre tra quelli validi
                validPredictions.stream()
                        .filter(p -> p.getUser().getId().equals(currentUser.getId()))
                        .findFirst()
                        .ifPresent(p -> betDTO.setUserPrediction(p.getPrediction().name()));
            }
        }

        return betDTO;
    }
}