package it.fantamaggiore.backend.fantasy.service;

import it.fantamaggiore.backend.core.model.User;
import it.fantamaggiore.backend.core.repository.UserRepository;
import it.fantamaggiore.backend.fantasy.dto.RankingDTO;
import it.fantamaggiore.backend.fantasy.model.Formation;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

@Service
public class RankingService {

    @Autowired
    private UserRepository userRepository;

    @Cacheable("globalRanking")
    @Transactional(readOnly = true)
    public List<RankingDTO> getGlobalRanking() {
        List<User> users = userRepository.findAllWithFormations();
        List<RankingDTO> results = new ArrayList<RankingDTO>();

        for (User user : users) {
            double[] stats = calculateUserStats(user);
            double sum = stats[0];
            double maxScore = stats[1];

            // 🔥 FIX: Aggiunto fantasyTeamName (che mancava) e previousPosition!
            results.add(new RankingDTO(
                    user.getId(),
                    user.getFantasyTeamName(),
                    user.getName(),
                    user.getSurname(),
                    sum,
                    maxScore,
                    (double) user.getBetPoints(),
                    user.getPreviousPosition() != null ? user.getPreviousPosition() : 0
            ));
        }

        results.sort(
                Comparator.comparing(RankingDTO::getTotalPoints).reversed()
                        .thenComparing(Comparator.comparing(RankingDTO::getMaxSingleMatchScore).reversed())
                        .thenComparing(RankingDTO::getUserName));
        return results;
    }


    private double[] calculateUserStats(User user) {
        double sum = (double) user.getBetPoints();
        double maxScore= 0.0;
        if (user.getFormations() != null && !user.getFormations().isEmpty()) {
            for (Formation f : user.getFormations()) {
                double score = f.getTotalScore();
                sum += score;
                // Se il punteggio di questa giornata è il più alto finora, lo salvo
                if (score > maxScore) {
                    maxScore = score;
                }
            }
        }
        return new double[]{sum, maxScore};
    }
}
